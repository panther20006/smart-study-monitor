/* =========================================================
   SMART STUDY MONITOR
   DIRECT CAMERA + EYE DETECTION + AUDIO
========================================================= */


/* =========================================
   ELEMENTS
========================================= */

const video =
    document.getElementById("video");

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext("2d");

const warning =
    document.getElementById("warning");

const cameraMessage =
    document.getElementById("cameraMessage");

const eyeAudio =
    document.getElementById("eyeAudio");

const leftEAR =
    document.getElementById("leftEAR");

const rightEAR =
    document.getElementById("rightEAR");

const averageEAR =
    document.getElementById("averageEAR");

const eyeStatus =
    document.getElementById("eyeStatus");


/* =========================================
   SETTINGS
========================================= */

const EYE_THRESHOLD = 0.21;

const EYE_CLOSED_TIME = 1200;

const DETECTION_DELAY = 80;

const AUDIO_COOLDOWN = 5000;


/* =========================================
   VARIABLES
========================================= */

let faceMesh = null;

let cameraStream = null;

let detectionRunning = false;

let eyesClosedSince = null;

let eyesClosed = false;

let lastAudioTime = 0;

let audioUnlocked = false;


/* =========================================
   PAGE LOAD
========================================= */

window.addEventListener(
    "load",
    () => {

        console.log(
            "Page loaded"
        );

        startEverything();

    }
);


/* =========================================
   START EVERYTHING
========================================= */

async function startEverything() {

    /*
     * First prepare FaceMesh
     */

    initializeFaceMesh();


    /*
     * Direct camera
     */

    await startCamera();

}


/* =========================================
   CAMERA
========================================= */

async function startCamera() {

    console.log(
        "Requesting camera..."
    );


    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            showMessage(
                "Camera requires HTTPS"
            );

            return;
        }


        /*
         * Camera permission
         */

        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    },

                    facingMode: "user"

                },

                audio: false

            });


        /*
         * Attach
         */

        video.srcObject =
            cameraStream;


        /*
         * Wait
         */

        await new Promise(
            resolve => {

                if (
                    video.readyState >= 2
                ) {

                    resolve();

                    return;
                }


                video.onloadedmetadata =
                    () => {

                        resolve();

                    };

            }
        );


        /*
         * Play
         */

        await video.play();


        /*
         * Canvas
         */

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        /*
         * Hide message
         */

        cameraMessage.classList.add(
            "hide"
        );


        console.log(
            "✓ CAMERA STARTED"
        );


        /*
         * Start eye AI
         */

        startEyeDetection();


    } catch (error) {

        console.error(
            "Camera Error:",
            error
        );


        showMessage(
            "Camera permission Allow karo"
        );

    }

}


/* =========================================
   MESSAGE
========================================= */

function showMessage(text) {

    cameraMessage.textContent =
        text;

    cameraMessage.classList.remove(
        "hide"
    );

}


/* =========================================
   MEDIAPIPE
========================================= */

function initializeFaceMesh() {

    if (
        typeof FaceMesh ===
        "undefined"
    ) {

        console.error(
            "FaceMesh library not loaded"
        );

        showMessage(
            "AI library loading..."
        );

        return;
    }


    faceMesh =
        new FaceMesh({

            locateFile: file => {

                return (
                    "https://cdn.jsdelivr.net/npm/" +
                    "@mediapipe/face_mesh/" +
                    file
                );

            }

        });


    faceMesh.setOptions({

        maxNumFaces: 1,

        refineLandmarks: true,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

    });


    faceMesh.onResults(
        faceResults
    );


    console.log(
        "✓ FaceMesh ready"
    );

}


/* =========================================
   EYE DETECTION
========================================= */

async function startEyeDetection() {

    if (
        detectionRunning
    ) {

        return;
    }


    if (!faceMesh) {

        console.error(
            "FaceMesh not ready"
        );

        return;
    }


    detectionRunning =
        true;


    console.log(
        "✓ EYE DETECTION STARTED"
    );


    while (
        detectionRunning
    ) {

        if (

            video.readyState >= 2 &&

            video.videoWidth > 0

        ) {

            try {

                await faceMesh.send({

                    image: video

                });

            } catch (error) {

                console.warn(
                    "Eye detection error:",
                    error
                );

            }

        }


        await sleep(
            DETECTION_DELAY
        );

    }

}


/* =========================================
   FACE RESULTS
========================================= */

function faceResults(results) {

    /*
     * No face
     */

    if (

        !results.multiFaceLandmarks ||

        results.multiFaceLandmarks.length === 0

    ) {

        leftEAR.textContent =
            "--";

        rightEAR.textContent =
            "--";

        averageEAR.textContent =
            "--";

        eyeStatus.textContent =
            "NO FACE";

        eyeStatus.className =
            "";

        resetEyes();

        return;
    }


    /*
     * Face
     */

    const landmarks =
        results.multiFaceLandmarks[0];


    /*
     * Left eye
     */

    const left =
        calculateEAR(
            landmarks,
            [
                33,
                160,
                158,
                133,
                153,
                144
            ]
        );


    /*
     * Right eye
     */

    const right =
        calculateEAR(
            landmarks,
            [
                362,
                385,
                387,
                263,
                373,
                380
            ]
        );


    /*
     * Average
     */

    const avg =
        (left + right) / 2;


    /*
     * Display
     */

    leftEAR.textContent =
        left.toFixed(3);

    rightEAR.textContent =
        right.toFixed(3);

    averageEAR.textContent =
        avg.toFixed(3);


    /*
     * Eye state
     */

    if (
        avg < EYE_THRESHOLD
    ) {

        eyesAreClosed();

    } else {

        eyesAreOpen();

    }

}


/* =========================================
   EAR CALCULATION
========================================= */

function calculateEAR(
    landmarks,
    points
) {

    const p1 =
        landmarks[points[0]];

    const p2 =
        landmarks[points[1]];

    const p3 =
        landmarks[points[2]];

    const p4 =
        landmarks[points[3]];

    const p5 =
        landmarks[points[4]];

    const p6 =
        landmarks[points[5]];


    const vertical1 =
        distance(p2, p6);


    const vertical2 =
        distance(p3, p5);


    const horizontal =
        distance(p1, p4);


    if (
        horizontal === 0
    ) {

        return 1;

    }


    return (

        vertical1 +
        vertical2

    ) / (

        2 *
        horizontal

    );

}


/* =========================================
   DISTANCE
========================================= */

function distance(a, b) {

    const x =
        a.x - b.x;

    const y =
        a.y - b.y;


    return Math.sqrt(
        x * x +
        y * y
    );

}


/* =========================================
   EYES CLOSED
========================================= */

function eyesAreClosed() {

    /*
     * Start timer
     */

    if (
        eyesClosedSince === null
    ) {

        eyesClosedSince =
            performance.now();

    }


    /*
     * Before warning
     */

    if (!eyesClosed) {

        eyeStatus.textContent =
            "CLOSING";

        eyeStatus.className =
            "closed";

    }


    /*
     * Time
     */

    const time =
        performance.now() -
        eyesClosedSince;


    /*
     * 1.2 seconds
     */

    if (
        time >=
        EYE_CLOSED_TIME
    ) {

        if (!eyesClosed) {

            eyesClosed =
                true;


            eyeStatus.textContent =
                "CLOSED";

            eyeStatus.className =
                "closed";


            showWarning();

            playEyeAudio();

        }

    }

}


/* =========================================
   EYES OPEN
========================================= */

function eyesAreOpen() {

    eyesClosedSince =
        null;


    eyeStatus.textContent =
        "OPEN";

    eyeStatus.className =
        "open";


    if (
        eyesClosed
    ) {

        eyesClosed =
            false;

        hideWarning();

    }

}


/* =========================================
   RESET
========================================= */

function resetEyes() {

    eyesClosedSince =
        null;

    eyesClosed =
        false;

    hideWarning();

}


/* =========================================
   WARNING
========================================= */

function showWarning() {

    warning.textContent =
        "WAKE UP!";

    warning.className =
        "warning show";

}


/* =========================================
   HIDE WARNING
========================================= */

function hideWarning() {

    warning.classList.remove(
        "show"
    );

}


/* =========================================
   AUDIO
========================================= */

function playEyeAudio() {

    if (!eyeAudio) {

        console.error(
            "eye.mp3 not found"
        );

        return;
    }


    const now =
        Date.now();


    /*
     * Cooldown
     */

    if (
        now - lastAudioTime <
        AUDIO_COOLDOWN
    ) {

        return;
    }


    lastAudioTime =
        now;


    console.log(
        "Playing eye.mp3..."
    );


    try {

        eyeAudio.pause();

        eyeAudio.currentTime =
            0;

        eyeAudio.volume =
            1;

        eyeAudio.muted =
            false;


        eyeAudio.play()
            .then(() => {

                console.log(
                    "✓ eye.mp3 playing"
                );

            })
            .catch(error => {

                console.error(
                    "Audio blocked:",
                    error
                );

                /*
                 * Browser blocked autoplay.
                 * User interaction required.
                 */

            });


    } catch (error) {

        console.error(
            "Audio error:",
            error
        );

    }

}


/* =========================================
   SLEEP
========================================= */

function sleep(ms) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                ms
            );

        }
    );

}


/* =========================================
   CLEANUP
========================================= */

window.addEventListener(
    "beforeunload",
    () => {

        detectionRunning =
            false;


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track => {
                        track.stop();
                    }
                );

        }

    }
);