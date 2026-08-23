/* =========================================================
   SMART STUDY MONITOR
   FINAL VERSION
   Eye + Phone + Audio
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

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

const startButton =
    document.getElementById("startButton");

const eyeAudio =
    document.getElementById("eyeAudio");

const phoneAudio =
    document.getElementById("phoneAudio");

const leftEAR =
    document.getElementById("leftEAR");

const rightEAR =
    document.getElementById("rightEAR");

const averageEAR =
    document.getElementById("averageEAR");

const eyeStatus =
    document.getElementById("eyeStatus");


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {

    /*
     * Eyes must remain closed
     * for 1.2 seconds
     */
    eyeClosedDuration: 1200,

    /*
     * EAR threshold
     *
     * MediaPipe usually:
     * Open = ~0.25 - 0.40
     * Closed = ~0.10 - 0.20
     */
    eyeThreshold: 0.20,

    /*
     * Phone confidence
     */
    phoneConfidence: 0.45,

    /*
     * Phone detection every 700ms
     */
    phoneInterval: 700,

    /*
     * Face detection interval
     */
    faceInterval: 40,

    /*
     * Warning audio cooldown
     *
     * Prevents audio spam.
     */
    audioCooldown: 5000
};


/* =========================================================
   STATE
========================================================= */

let faceMesh = null;

let phoneModel = null;

let stream = null;

let faceRunning = false;

let phoneRunning = false;

let detectingPhone = false;

let eyesClosedSince = null;

let eyesClosed = false;

let phoneDetected = false;

let monitoringStarted = false;

let lastEyeAudio = 0;

let lastPhoneAudio = 0;

let warningType = "";


/* =========================================================
   START MONITOR
========================================================= */

async function startMonitor() {

    if (monitoringStarted) {
        return;
    }

    monitoringStarted = true;

    startButton.classList.add("hidden");

    cameraMessage.textContent =
        "Starting camera...";

    cameraMessage.classList.add("show");


    /*
     * Prepare audio.
     *
     * This click gives browser
     * permission for audio playback.
     */
    try {

        eyeAudio.load();
        phoneAudio.load();

    } catch (error) {

        console.log(
            "Audio prepare error:",
            error
        );
    }


    /*
     * Camera
     */

    await startCamera();


    /*
     * Face Mesh
     */

    initializeFaceMesh();


    /*
     * Phone model in background
     */

    loadPhoneModel();
}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    try {

        stream =
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


        video.srcObject = stream;


        await video.play();


        /*
         * Canvas
         */

        canvas.width =
            video.videoWidth || 1280;

        canvas.height =
            video.videoHeight || 720;


        cameraMessage.classList.remove(
            "show"
        );


        /*
         * Start face loop
         */

        startFaceDetection();


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        cameraMessage.textContent =
            "Camera permission denied or unavailable.";

        cameraMessage.classList.add(
            "show"
        );

        startButton.textContent =
            "RETRY CAMERA";

        startButton.classList.remove(
            "hidden"
        );

        monitoringStarted = false;
    }
}


/* =========================================================
   MEDIAPIPE FACE MESH
========================================================= */

function initializeFaceMesh() {

    faceMesh =
        new FaceMesh({

            locateFile: (file) => {

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
        handleFaceResults
    );
}


/* =========================================================
   FACE LOOP
========================================================= */

async function startFaceDetection() {

    if (faceRunning) {
        return;
    }

    faceRunning = true;


    while (faceRunning) {

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
                    "Face error:",
                    error
                );
            }
        }


        await sleep(
            SETTINGS.faceInterval
        );
    }
}


/* =========================================================
   FACE RESULTS
========================================================= */

function handleFaceResults(results) {

    /*
     * No face
     */

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        resetEyes();

        leftEAR.textContent = "--";
        rightEAR.textContent = "--";
        averageEAR.textContent = "--";

        eyeStatus.textContent =
            "NO FACE";

        eyeStatus.className =
            "waiting";

        return;
    }


    /*
     * Face found
     */

    const landmarks =
        results.multiFaceLandmarks[0];


    /*
     * LEFT EYE
     */

    const left =
        getEyeEAR(
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
     * RIGHT EYE
     */

    const right =
        getEyeEAR(
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
     * CLOSED
     */

    if (
        avg <
        SETTINGS.eyeThreshold
    ) {

        handleEyesClosed();

    } else {

        resetEyes();
    }
}


/* =========================================================
   EYE EAR
========================================================= */

function getEyeEAR(
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


    if (horizontal === 0) {
        return 1;
    }


    return (
        (vertical1 + vertical2) /
        (2 * horizontal)
    );
}


/* =========================================================
   DISTANCE
========================================================= */

function distance(a, b) {

    const dx =
        a.x - b.x;

    const dy =
        a.y - b.y;

    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


/* =========================================================
   EYES CLOSED
========================================================= */

function handleEyesClosed() {

    eyeStatus.textContent =
        "CLOSING";

    eyeStatus.className =
        "closed";


    /*
     * Start timer
     */

    if (eyesClosedSince === null) {

        eyesClosedSince =
            performance.now();

        return;
    }


    /*
     * Duration
     */

    const duration =
        performance.now() -
        eyesClosedSince;


    /*
     * 1.2 seconds complete
     */

    if (
        duration >=
        SETTINGS.eyeClosedDuration
    ) {

        if (!eyesClosed) {

            eyesClosed = true;

            eyeStatus.textContent =
                "CLOSED";

            showEyeWarning();
        }
    }
}


/* =========================================================
   RESET EYES
========================================================= */

function resetEyes() {

    eyesClosedSince = null;


    if (eyesClosed) {

        eyesClosed = false;

        updateWarning();
    }


    /*
     * Don't overwrite NO FACE
     */

    if (
        eyeStatus.textContent !==
        "NO FACE"
    ) {

        eyeStatus.textContent =
            "OPEN";

        eyeStatus.className =
            "open";
    }
}


/* =========================================================
   EYE WARNING
========================================================= */

function showEyeWarning() {

    /*
     * If phone is detected,
     * phone warning has priority.
     */

    updateWarning();


    /*
     * Audio only once per event/cooldown.
     */

    playEyeAudio();
}


/* =========================================================
   LOAD PHONE MODEL
========================================================= */

async function loadPhoneModel() {

    try {

        console.log(
            "Loading phone detection..."
        );


        phoneModel =
            await cocoSsd.load();


        console.log(
            "Phone detection READY"
        );


        /*
         * Start detection
         */

        startPhoneDetection();


    } catch (error) {

        console.error(
            "Phone model error:",
            error
        );
    }
}


/* =========================================================
   PHONE DETECTION LOOP
========================================================= */

async function startPhoneDetection() {

    if (phoneRunning) {
        return;
    }

    if (!phoneModel) {
        return;
    }


    phoneRunning = true;


    while (phoneRunning) {

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            !detectingPhone
        ) {

            await detectPhone();
        }


        await sleep(
            SETTINGS.phoneInterval
        );
    }
}


/* =========================================================
   DETECT PHONE
========================================================= */

async function detectPhone() {

    if (
        detectingPhone ||
        !phoneModel
    ) {

        return;
    }


    detectingPhone = true;


    try {

        /*
         * Canvas
         */

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        /*
         * Draw camera frame
         */

        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        /*
         * Detect
         */

        const predictions =
            await phoneModel.detect(
                canvas
            );


        /*
         * Find cell phone
         */

        const phone =
            predictions.some(
                prediction => {

                    return (
                        prediction.class ===
                        "cell phone" &&
                        prediction.score >=
                        SETTINGS.phoneConfidence
                    );
                }
            );


        /*
         * PHONE FOUND
         */

        if (phone) {

            if (!phoneDetected) {

                phoneDetected = true;

                showPhoneWarning();
            }

        }


        /*
         * PHONE NOT FOUND
         */

        else {

            if (phoneDetected) {

                phoneDetected = false;

                updateWarning();
            }
        }


    } catch (error) {

        console.warn(
            "Phone detection error:",
            error
        );

    } finally {

        detectingPhone = false;
    }
}


/* =========================================================
   PHONE WARNING
========================================================= */

function showPhoneWarning() {

    updateWarning();

    playPhoneAudio();
}


/* =========================================================
   WARNING MANAGEMENT
========================================================= */

function updateWarning() {

    /*
     * PHONE HAS PRIORITY
     */

    if (phoneDetected) {

        setWarning(
            "PUT PHONE AWAY!",
            "phone"
        );

        return;
    }


    /*
     * EYES CLOSED
     */

    if (eyesClosed) {

        setWarning(
            "WAKE UP!",
            "eye"
        );

        return;
    }


    /*
     * NOTHING
     */

    hideWarning();
}


/* =========================================================
   SET WARNING
========================================================= */

function setWarning(
    text,
    type
) {

    /*
     * IMPORTANT:
     * Don't restart animation every frame.
     */

    if (
        warningType === type &&
        warning.classList.contains("show")
    ) {

        return;
    }


    warningType = type;


    warning.textContent =
        text;


    warning.className =
        "warning";


    warning.classList.add(
        type
    );


    /*
     * Animation restart
     */

    void warning.offsetWidth;


    warning.classList.add(
        "show"
    );
}


/* =========================================================
   HIDE WARNING
========================================================= */

function hideWarning() {

    warningType = "";

    warning.classList.remove(
        "show"
    );

    warning.classList.remove(
        "eye",
        "phone"
    );

    warning.textContent = "";
}


/* =========================================================
   EYE AUDIO
========================================================= */

function playEyeAudio() {

    const now =
        Date.now();


    /*
     * Cooldown
     */

    if (
        now - lastEyeAudio <
        SETTINGS.audioCooldown
    ) {

        return;
    }


    lastEyeAudio = now;


    playAudio(
        eyeAudio
    );
}


/* =========================================================
   PHONE AUDIO
========================================================= */

function playPhoneAudio() {

    const now =
        Date.now();


    /*
     * Cooldown
     */

    if (
        now - lastPhoneAudio <
        SETTINGS.audioCooldown
    ) {

        return;
    }


    lastPhoneAudio = now;


    playAudio(
        phoneAudio
    );
}


/* =========================================================
   PLAY AUDIO
========================================================= */

function playAudio(audio) {

    try {

        /*
         * Restart
         */

        audio.pause();

        audio.currentTime = 0;


        /*
         * Play
         */

        const promise =
            audio.play();


        if (promise) {

            promise.catch(
                error => {

                    console.warn(
                        "Audio blocked:",
                        error
                    );
                }
            );
        }


    } catch (error) {

        console.error(
            "Audio error:",
            error
        );
    }
}


/* =========================================================
   SLEEP
========================================================= */

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* =========================================================
   START BUTTON
========================================================= */

startButton.addEventListener(
    "click",
    startMonitor
);


/* =========================================================
   PAGE LOAD
========================================================= */

console.log(
    "Smart Study Monitor loaded."
);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        faceRunning = false;

        phoneRunning = false;


        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }
    }
);