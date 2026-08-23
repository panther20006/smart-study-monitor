/* =========================================================
   SMART STUDY MONITOR
   FINAL VERSION
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const warning = document.getElementById("warning");
const cameraMessage = document.getElementById("cameraMessage");

const leftEARText = document.getElementById("leftEAR");
const rightEARText = document.getElementById("rightEAR");
const averageEARText = document.getElementById("averageEAR");
const eyeStatus = document.getElementById("eyeStatus");

const eyeAudio = document.getElementById("eyeAudio");
const phoneAudio = document.getElementById("phoneAudio");

const ctx = canvas.getContext("2d");


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {

    /* Eyes must stay closed this long */
    eyeClosedDuration: 1200,

    /* Eye threshold */
    eyeThreshold: 0.21,

    /* Phone confidence */
    phoneConfidence: 0.45,

    /* Phone detection interval */
    phoneInterval: 800,

    /* Eye detection interval */
    eyeInterval: 80,

    /* Audio cooldown */
    audioCooldown: 5000

};


/* =========================================================
   STATE
========================================================= */

let faceMesh = null;
let phoneModel = null;

let cameraStream = null;

let faceRunning = false;
let phoneRunning = false;

let phoneBusy = false;

let eyesClosedSince = null;

let eyesClosed = false;
let phoneDetected = false;

let lastEyeAudio = 0;
let lastPhoneAudio = 0;

let lastWarning = "";


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

    try {

        cameraMessage.textContent =
            "Starting camera...";


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


        video.srcObject = cameraStream;


        await video.play();


        video.addEventListener(
            "loadedmetadata",
            setupCamera,
            { once: true }
        );


        /* If already loaded */
        if (
            video.videoWidth > 0 &&
            video.videoHeight > 0
        ) {

            setupCamera();

        }


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        cameraMessage.textContent =
            "Camera permission denied. Please allow camera access.";


    }

}


/* =========================================================
   CAMERA SETUP
========================================================= */

function setupCamera() {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    cameraMessage.classList.add("hide");


    console.log(
        "Camera:",
        video.videoWidth,
        "x",
        video.videoHeight
    );


    /* Start eyes */

    if (faceMesh) {

        startFaceDetection();

    }


    /* Start phone if model ready */

    if (phoneModel) {

        startPhoneDetection();

    }

}


/* =========================================================
   MEDIAPIPE
========================================================= */

function initializeFaceMesh() {

    if (typeof FaceMesh === "undefined") {

        console.error(
            "MediaPipe FaceMesh not loaded."
        );

        return;

    }


    faceMesh = new FaceMesh({

        locateFile: function(file) {

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


    console.log(
        "Eye detection ready"
    );

}


/* =========================================================
   FACE RESULTS
========================================================= */

function handleFaceResults(results) {

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        resetEyes();

        leftEARText.textContent = "--";
        rightEARText.textContent = "--";
        averageEARText.textContent = "--";

        eyeStatus.textContent = "NO FACE";
        eyeStatus.className = "waiting";

        return;

    }


    const landmarks =
        results.multiFaceLandmarks[0];


    /* LEFT EYE */

    const left =
        getEyeEAR(
            landmarks,
            [33, 160, 158, 133, 153, 144]
        );


    /* RIGHT EYE */

    const right =
        getEyeEAR(
            landmarks,
            [362, 385, 387, 263, 373, 380]
        );


    const average =
        (left + right) / 2;


    /* Display */

    leftEARText.textContent =
        left.toFixed(3);

    rightEARText.textContent =
        right.toFixed(3);

    averageEARText.textContent =
        average.toFixed(3);


    console.log(
        "EAR:",
        left.toFixed(3),
        right.toFixed(3),
        average.toFixed(3)
    );


    /* =====================================================
       EYE CLOSED
    ===================================================== */

    if (
        average < SETTINGS.eyeThreshold
    ) {

        handleEyesClosed();

    } else {

        handleEyesOpen();

    }

}


/* =========================================================
   EYE EAR
========================================================= */

function getEyeEAR(landmarks, points) {

    const p1 = landmarks[points[0]];
    const p2 = landmarks[points[1]];
    const p3 = landmarks[points[2]];
    const p4 = landmarks[points[3]];
    const p5 = landmarks[points[4]];
    const p6 = landmarks[points[5]];


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

    const dx = a.x - b.x;
    const dy = a.y - b.y;

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
        "CLOSED";

    eyeStatus.className =
        "closed";


    /* Start timer */

    if (eyesClosedSince === null) {

        eyesClosedSince =
            performance.now();

        return;

    }


    const duration =
        performance.now() -
        eyesClosedSince;


    /* 1.2 seconds reached */

    if (
        duration >=
        SETTINGS.eyeClosedDuration
    ) {

        if (!eyesClosed) {

            eyesClosed = true;

            showEyeWarning();

        }

    }

}


/* =========================================================
   EYES OPEN
========================================================= */

function handleEyesOpen() {

    eyesClosedSince = null;


    if (eyesClosed) {

        eyesClosed = false;

    }


    eyeStatus.textContent =
        "OPEN";

    eyeStatus.className =
        "open";


    updateWarning();

}


/* =========================================================
   RESET EYES
========================================================= */

function resetEyes() {

    eyesClosedSince = null;

    eyesClosed = false;

    updateWarning();

}


/* =========================================================
   FACE LOOP
========================================================= */

async function startFaceDetection() {

    if (faceRunning) {
        return;
    }


    if (!faceMesh) {
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
            SETTINGS.eyeInterval
        );

    }

}


/* =========================================================
   COCO SSD
========================================================= */

async function initializePhoneModel() {

    try {

        console.log(
            "Loading phone detection..."
        );


        if (
            typeof cocoSsd === "undefined"
        ) {

            console.error(
                "COCO-SSD not loaded."
            );

            return;

        }


        phoneModel =
            await cocoSsd.load();


        console.log(
            "Phone detection ready"
        );


        if (
            video.videoWidth > 0
        ) {

            startPhoneDetection();

        }

    } catch (error) {

        console.error(
            "Phone model error:",
            error
        );

    }

}


/* =========================================================
   PHONE LOOP
========================================================= */

async function startPhoneDetection() {

    if (phoneRunning) {
        return;
    }


    if (!phoneModel) {
        return;
    }


    phoneRunning = true;


    console.log(
        "Phone monitoring started"
    );


    while (phoneRunning) {

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            !phoneBusy
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

    if (phoneBusy) {
        return;
    }


    phoneBusy = true;


    try {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );


        const predictions =
            await phoneModel.detect(
                canvas
            );


        let found = false;


        for (
            const prediction
            of predictions
        ) {

            if (
                prediction.class ===
                "cell phone" &&
                prediction.score >=
                SETTINGS.phoneConfidence
            ) {

                found = true;

                console.log(
                    "PHONE DETECTED:",
                    prediction.score
                );

                break;

            }

        }


        if (found) {

            if (!phoneDetected) {

                phoneDetected = true;

                showPhoneWarning();

            }

        } else {

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

        phoneBusy = false;

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
   WARNING UPDATE
========================================================= */

function updateWarning() {

    /* Phone has priority */

    if (phoneDetected) {

        setWarning(
            "PUT THE PHONE AWAY!",
            "phone"
        );

        return;

    }


    if (eyesClosed) {

        setWarning(
            "WAKE UP!",
            "eye"
        );

        return;

    }


    hideWarning();

}


/* =========================================================
   SET WARNING
========================================================= */

function setWarning(text, type) {

    const key =
        type + ":" + text;


    if (
        lastWarning === key &&
        warning.classList.contains("show")
    ) {

        return;

    }


    lastWarning = key;


    warning.textContent =
        text;


    warning.className =
        "warning " + type;


    void warning.offsetWidth;


    warning.classList.add(
        "show"
    );

}


/* =========================================================
   HIDE WARNING
========================================================= */

function hideWarning() {

    lastWarning = "";

    warning.classList.remove(
        "show"
    );

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

    if (!audio) {

        console.error(
            "Audio element missing"
        );

        return;

    }


    console.log(
        "Playing audio:",
        audio.src
    );


    try {

        audio.pause();

        audio.currentTime = 0;


        const promise =
            audio.play();


        if (
            promise !== undefined
        ) {

            promise.catch(error => {

                console.warn(
                    "Browser blocked audio:",
                    error
                );

                /*
                 * Some browsers require
                 * one user interaction.
                 */

            });

        }

    } catch (error) {

        console.error(
            "Audio error:",
            error
        );

    }

}


/* =========================================================
   UTILITY
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
   INITIALIZE
========================================================= */

async function initialize() {

    console.log(
        "SMART STUDY MONITOR STARTING..."
    );


    /*
     * Initialize FaceMesh
     */

    initializeFaceMesh();


    /*
     * Start camera
     */

    await startCamera();


    /*
     * Load phone AI in background
     */

    setTimeout(() => {

        initializePhoneModel();

    }, 500);

}


/* =========================================================
   START
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

        faceRunning = false;

        phoneRunning = false;


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

        }

    }
);