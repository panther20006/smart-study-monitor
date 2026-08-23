/* =========================================================
   SMART STUDY MONITOR
   FAST OPTIMIZED JS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const warning = document.getElementById("warning");
const cameraMessage = document.getElementById("cameraMessage");

const eyeAudio = document.getElementById("eyeAudio");
const phoneAudio = document.getElementById("phoneAudio");

const leftEAR = document.getElementById("leftEAR");
const rightEAR = document.getElementById("rightEAR");
const averageEAR = document.getElementById("averageEAR");
const eyeStatus = document.getElementById("eyeStatus");

const ctx = canvas.getContext("2d", {
    willReadFrequently: true
});


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {

    // Eyes closed continuously for 1.2 seconds
    eyeClosedDuration: 1200,

    // EAR threshold
    eyeThreshold: 0.21,

    // Eye detection interval
    eyeDetectionInterval: 80,

    // Phone confidence
    phoneConfidence: 0.55,

    // Phone detection interval
    phoneDetectionInterval: 1000,

    // Audio delay
    audioDelay: 250,

    // Audio cooldown
    audioCooldown: 5000

};


/* =========================================================
   STATE
========================================================= */

let faceMesh = null;
let phoneModel = null;

let cameraStream = null;

let faceLoopRunning = false;
let phoneLoopRunning = false;

let phoneModelLoading = false;
let isDetectingPhone = false;

let eyesClosedSince = null;

let eyesClosed = false;
let phoneDetected = false;

let lastEyeAudio = 0;
let lastPhoneAudio = 0;

let eyeAudioTimer = null;
let phoneAudioTimer = null;

let lastWarningType = null;


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

    try {

        cameraMessage.textContent =
            "Starting camera...";

        cameraMessage.classList.add("show");


        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    width: {
                        ideal: 640
                    },

                    height: {
                        ideal: 480
                    },

                    facingMode: "user"
                },

                audio: false

            });


        video.srcObject = cameraStream;


        video.onloadedmetadata = async () => {

            try {

                await video.play();

            } catch (error) {

                console.warn(
                    "Video play error:",
                    error
                );

            }


            canvas.width =
                video.videoWidth || 640;

            canvas.height =
                video.videoHeight || 480;


            cameraMessage.classList.remove(
                "show"
            );


            if (faceMesh) {

                startFaceDetection();

            }

        };


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        cameraMessage.textContent =
            "Please allow camera access.";

        cameraMessage.classList.add(
            "show"
        );

    }

}


/* =========================================================
   MEDIAPIPE FACE MESH
========================================================= */

function initializeFaceMesh() {

    faceMesh = new FaceMesh({

        locateFile: (file) => {

            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;

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
   FACE RESULTS
========================================================= */

function handleFaceResults(results) {

    /*
     * Face not detected
     */

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        resetEyes();

        eyeStatus.textContent =
            "WAITING";

        eyeStatus.className =
            "waiting";

        return;

    }


    /*
     * Face detected
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
     * AVERAGE
     */

    const average =
        (left + right) / 2;


    /*
     * Update eye ratio
     */

    leftEAR.textContent =
        left.toFixed(3);

    rightEAR.textContent =
        right.toFixed(3);

    averageEAR.textContent =
        average.toFixed(3);


    /*
     * Eye detection
     */

    if (
        average <
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


    if (horizontal <= 0) {

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

    if (
        eyesClosedSince === null
    ) {

        eyesClosedSince =
            performance.now();

        return;

    }


    /*
     * Calculate duration
     */

    const duration =
        performance.now() -
        eyesClosedSince;


    /*
     * Closed for 1.2 seconds
     */

    if (
        duration >=
        SETTINGS.eyeClosedDuration
    ) {

        if (!eyesClosed) {

            eyesClosed = true;


            eyeStatus.textContent =
                "CLOSED";

            eyeStatus.className =
                "closed";


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

        eyeStatus.textContent =
            "OPEN";

        eyeStatus.className =
            "open";

        updateWarning();

    }

}


/* =========================================================
   FACE DETECTION LOOP
========================================================= */

async function startFaceDetection() {

    if (faceLoopRunning) {
        return;
    }


    if (!faceMesh) {
        return;
    }


    faceLoopRunning = true;


    while (faceLoopRunning) {

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
                    "Face detection:",
                    error
                );

            }

        }


        await sleep(
            SETTINGS.eyeDetectionInterval
        );

    }

}


/* =========================================================
   COCO SSD PHONE MODEL
========================================================= */

async function initializePhoneModel() {

    if (
        phoneModelLoading ||
        phoneModel
    ) {

        return;

    }


    phoneModelLoading = true;


    try {

        /*
         * Lightweight model
         */

        phoneModel =
            await cocoSsd.load({
                base: "lite_mobilenet_v2"
            });


        console.log(
            "Phone detection ready"
        );


        startPhoneDetection();


    } catch (error) {

        console.error(
            "Phone model error:",
            error
        );

    } finally {

        phoneModelLoading = false;

    }

}


/* =========================================================
   PHONE DETECTION LOOP
========================================================= */

async function startPhoneDetection() {

    if (phoneLoopRunning) {
        return;
    }


    if (!phoneModel) {
        return;
    }


    phoneLoopRunning = true;


    while (phoneLoopRunning) {

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0
        ) {

            await detectPhone();

        }


        await sleep(
            SETTINGS.phoneDetectionInterval
        );

    }

}


/* =========================================================
   DETECT PHONE
========================================================= */

async function detectPhone() {

    if (
        isDetectingPhone ||
        !phoneModel
    ) {

        return;

    }


    isDetectingPhone = true;


    try {

        /*
         * Capture frame
         */

        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        /*
         * Detect objects
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
                        "cell phone"

                        &&

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
            "Phone detection:",
            error
        );

    } finally {

        isDetectingPhone = false;

    }

}


/* =========================================================
   EYE WARNING
========================================================= */

function showEyeWarning() {

    updateWarning();

    playEyeAudio();

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
     * Phone priority
     */

    if (phoneDetected) {

        setWarning(
            "PUT THE PHONE AWAY!",
            "phone"
        );

        return;

    }


    /*
     * Eye warning
     */

    if (eyesClosed) {

        setWarning(
            "WAKE UP!",
            "eye"
        );

        return;

    }


    /*
     * Nothing detected
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

    if (
        lastWarningType === type &&
        warning.textContent === text &&
        warning.classList.contains("show")
    ) {

        return;

    }


    lastWarningType = type;


    warning.textContent =
        text;


    warning.className =
        "warning";


    warning.classList.add(
        type
    );


    /*
     * Restart animation
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

    lastWarningType = null;


    warning.classList.remove(
        "show"
    );


    setTimeout(() => {

        if (
            !warning.classList.contains(
                "show"
            )
        ) {

            warning.className =
                "warning";

            warning.textContent =
                "";

        }

    }, 160);

}


/* =========================================================
   EYE AUDIO
========================================================= */

function playEyeAudio() {

    const now =
        Date.now();


    if (
        now - lastEyeAudio <
        SETTINGS.audioCooldown
    ) {

        return;

    }


    lastEyeAudio = now;


    clearTimeout(
        eyeAudioTimer
    );


    eyeAudioTimer =
        setTimeout(() => {

            playAudio(
                eyeAudio
            );

        }, SETTINGS.audioDelay);

}


/* =========================================================
   PHONE AUDIO
========================================================= */

function playPhoneAudio() {

    const now =
        Date.now();


    if (
        now - lastPhoneAudio <
        SETTINGS.audioCooldown
    ) {

        return;

    }


    lastPhoneAudio = now;


    clearTimeout(
        phoneAudioTimer
    );


    phoneAudioTimer =
        setTimeout(() => {

            playAudio(
                phoneAudio
            );

        }, SETTINGS.audioDelay);

}


/* =========================================================
   PLAY AUDIO
========================================================= */

function playAudio(audio) {

    if (!audio) {
        return;
    }


    try {

        audio.pause();

        audio.currentTime = 0;


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
   INITIALIZATION
========================================================= */

function initialize() {

    /*
     * FaceMesh initialize
     */

    initializeFaceMesh();


    /*
     * Camera immediately
     */

    startCamera();


    /*
     * Phone AI loads AFTER 1.5 sec
     * in background
     */

    setTimeout(() => {

        initializePhoneModel();

    }, 1500);

}


/* =========================================================
   PAGE LOAD
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

} else {

    initialize();

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        faceLoopRunning = false;

        phoneLoopRunning = false;


        /*
         * Stop camera
         */

        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

        }


        /*
         * Clear timers
         */

        clearTimeout(
            eyeAudioTimer
        );

        clearTimeout(
            phoneAudioTimer
        );

    }
);