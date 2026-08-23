/* =========================================================
   SMART STUDY MONITOR
   EYE + PHONE DETECTION
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const warning = document.getElementById("warning");
const cameraMessage = document.getElementById("cameraMessage");
const startBtn = document.getElementById("startBtn");

const eyeAudio = document.getElementById("eyeAudio");
const phoneAudio = document.getElementById("phoneAudio");

const leftEAR = document.getElementById("leftEAR");
const rightEAR = document.getElementById("rightEAR");
const averageEAR = document.getElementById("averageEAR");
const eyeStatus = document.getElementById("eyeStatus");


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {

    // Eyes continuously closed for 1.2 seconds
    eyeClosedDuration: 1200,

    // Eye closed sensitivity
    eyeThreshold: 0.21,

    // Face detection speed
    eyeDetectionInterval: 70,

    // Phone confidence
    phoneConfidence: 0.55,

    // Phone detection speed
    phoneDetectionInterval: 800,

    // Audio cooldown
    audioCooldown: 5000
};


/* =========================================================
   VARIABLES
========================================================= */

let faceMesh = null;
let phoneModel = null;

let cameraStream = null;

let faceLoopRunning = false;
let phoneLoopRunning = false;

let phoneDetecting = false;

let eyesClosedSince = null;

let eyesClosed = false;
let phoneDetected = false;

let lastEyeAudio = 0;
let lastPhoneAudio = 0;


/* =========================================================
   START BUTTON
========================================================= */

startBtn.addEventListener("click", async () => {

    try {

        // Unlock browser audio
        await unlockAudio();

        // Start camera
        await startCamera();

        // Load phone AI
        loadPhoneModel();

        startBtn.textContent =
            "✓ MONITORING ACTIVE";

        startBtn.classList.add("active");

        setTimeout(() => {

            startBtn.style.display = "none";

        }, 1000);

    } catch (error) {

        console.error(error);

    }

});


/* =========================================================
   AUDIO UNLOCK
========================================================= */

async function unlockAudio() {

    try {

        eyeAudio.muted = true;
        eyeAudio.currentTime = 0;

        await eyeAudio.play();

        eyeAudio.pause();
        eyeAudio.currentTime = 0;
        eyeAudio.muted = false;


        phoneAudio.muted = true;
        phoneAudio.currentTime = 0;

        await phoneAudio.play();

        phoneAudio.pause();
        phoneAudio.currentTime = 0;
        phoneAudio.muted = false;


        console.log("Audio unlocked");

    } catch (error) {

        console.warn(
            "Audio unlock failed:",
            error
        );

    }

}


/* =========================================================
   CAMERA
========================================================= */

async function startCamera() {

    try {

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


        video.srcObject =
            cameraStream;


        video.onloadedmetadata = async () => {

            await video.play();


            canvas.width =
                video.videoWidth;

            canvas.height =
                video.videoHeight;


            cameraMessage.classList.remove(
                "show"
            );


            // Start eye detection
            startFaceDetection();

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
     * Face not found
     */

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        leftEAR.textContent = "--";
        rightEAR.textContent = "--";
        averageEAR.textContent = "--";

        eyeStatus.textContent =
            "NO FACE";

        eyeStatus.className =
            "waiting";

        resetEyes();

        return;
    }


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
     * SHOW EAR
     */

    leftEAR.textContent =
        left.toFixed(3);

    rightEAR.textContent =
        right.toFixed(3);

    averageEAR.textContent =
        average.toFixed(3);


    /*
     * CHECK EYES
     */

    if (
        average <
        SETTINGS.eyeThreshold
    ) {

        handleEyesClosed();

    } else {

        handleEyesOpen();

    }

}


/* =========================================================
   EYE EAR CALCULATION
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
     * Calculate duration
     */

    const duration =
        performance.now() -
        eyesClosedSince;


    /*
     * Closed for 1.2 sec
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
   EYES OPEN
========================================================= */

function handleEyesOpen() {

    eyesClosedSince = null;


    eyeStatus.textContent =
        "OPEN";

    eyeStatus.className =
        "open";


    if (eyesClosed) {

        eyesClosed = false;

        updateWarning();

    }

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
   FACE DETECTION LOOP
========================================================= */

async function startFaceDetection() {

    if (faceLoopRunning) {

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
            "Phone detection ready"
        );


        startPhoneDetection();


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

    if (phoneLoopRunning) {

        return;

    }


    phoneLoopRunning = true;


    while (phoneLoopRunning) {

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            !phoneDetecting
        ) {

            await detectPhone();

        }


        await sleep(
            SETTINGS.phoneDetectionInterval
        );

    }

}


/* =========================================================
   PHONE DETECTION
========================================================= */

async function detectPhone() {

    if (
        !phoneModel ||
        phoneDetecting
    ) {

        return;

    }


    phoneDetecting = true;


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


        const found =
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

        if (found) {

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

    }


    phoneDetecting = false;

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
   WARNING MANAGER
========================================================= */

function updateWarning() {

    /*
     * PHONE HAS PRIORITY
     */

    if (phoneDetected) {

        setWarning(
            "PUT THE PHONE AWAY!",
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
   SHOW WARNING
========================================================= */

function setWarning(
    text,
    type
) {

    warning.textContent =
        text;


    warning.className =
        "warning " + type;


    warning.classList.add(
        "show"
    );

}


/* =========================================================
   HIDE WARNING
========================================================= */

function hideWarning() {

    warning.classList.remove(
        "show"
    );

    warning.textContent =
        "";

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


    lastEyeAudio =
        now;


    eyeAudio.pause();

    eyeAudio.currentTime = 0;

    eyeAudio.volume = 1;

    eyeAudio.muted = false;


    eyeAudio.play()
        .then(() => {

            console.log(
                "🔊 eye.mp3 playing"
            );

        })
        .catch(error => {

            console.error(
                "Eye audio blocked:",
                error
            );

        });

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


    lastPhoneAudio =
        now;


    phoneAudio.pause();

    phoneAudio.currentTime = 0;

    phoneAudio.volume = 1;

    phoneAudio.muted = false;


    phoneAudio.play()
        .then(() => {

            console.log(
                "🔊 phone.mp3 playing"
            );

        })
        .catch(error => {

            console.error(
                "Phone audio blocked:",
                error
            );

        });

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
   INITIALIZE
========================================================= */

function initialize() {

    initializeFaceMesh();

}


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


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

        }

    }
);