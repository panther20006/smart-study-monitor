/* =========================================================
   SMART STUDY MONITOR
   EYE DETECTION + AUDIO
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const warning = document.getElementById("warning");
const cameraMessage = document.getElementById("cameraMessage");

const eyeAudio = document.getElementById("eyeAudio");
const phoneAudio = document.getElementById("phoneAudio");

const startBtn = document.getElementById("startBtn");

const leftEAR = document.getElementById("leftEAR");
const rightEAR = document.getElementById("rightEAR");
const averageEAR = document.getElementById("averageEAR");
const eyeStatus = document.getElementById("eyeStatus");

const ctx = canvas.getContext("2d");


/* =========================================================
   SETTINGS
========================================================= */

const SETTINGS = {

    // Eye must remain closed for this long
    eyeClosedDuration: 1200,

    // Lower = more sensitive to closed eyes
    eyeThreshold: 0.20,

    // Face detection speed
    eyeDetectionInterval: 80,

    // Audio cooldown
    audioCooldown: 5000

};


/* =========================================================
   STATE
========================================================= */

let faceMesh = null;

let cameraStream = null;

let faceLoopRunning = false;

let eyesClosedSince = null;

let eyesClosed = false;

let audioUnlocked = false;

let lastEyeAudio = 0;

let eyeAudioTimer = null;


/* =========================================================
   START BUTTON
========================================================= */

startBtn.addEventListener("click", async () => {

    console.log("START clicked");

    // Unlock browser audio
    await unlockAudio();

    // Start camera
    await startCamera();

    startBtn.textContent = "✓ MONITORING ACTIVE";

    startBtn.classList.add("active");

    setTimeout(() => {

        startBtn.style.display = "none";

    }, 1000);

});


/* =========================================================
   AUDIO UNLOCK
========================================================= */

async function unlockAudio() {

    if (audioUnlocked) {
        return;
    }

    try {

        /*
         * Browser audio permission
         */

        eyeAudio.muted = true;

        await eyeAudio.play();

        eyeAudio.pause();

        eyeAudio.currentTime = 0;

        eyeAudio.muted = false;


        /*
         * Phone audio also unlock
         */

        if (phoneAudio) {

            phoneAudio.muted = true;

            await phoneAudio.play();

            phoneAudio.pause();

            phoneAudio.currentTime = 0;

            phoneAudio.muted = false;

        }


        audioUnlocked = true;

        console.log("Audio unlocked");

    } catch (error) {

        console.error(
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


        video.srcObject = cameraStream;


        video.onloadedmetadata = async () => {

            try {

                await video.play();

            } catch (error) {

                console.error(
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


            console.log(
                "Camera ready:",
                video.videoWidth,
                video.videoHeight
            );


            startFaceDetection();

        };


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        cameraMessage.textContent =
            "Camera permission denied.";

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

        /*
         * Important for eye landmarks
         */

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
     * No face
     */

    if (
        !results.multiFaceLandmarks ||
        results.multiFaceLandmarks.length === 0
    ) {

        leftEAR.textContent = "--";
        rightEAR.textContent = "--";
        averageEAR.textContent = "--";

        eyeStatus.textContent = "NO FACE";

        eyeStatus.className = "waiting";

        resetEyes();

        return;

    }


    /*
     * Get face
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

    const average =
        (left + right) / 2;


    /*
     * SHOW VALUES
     */

    leftEAR.textContent =
        left.toFixed(3);

    rightEAR.textContent =
        right.toFixed(3);

    averageEAR.textContent =
        average.toFixed(3);


    /*
     * DEBUG
     */

    console.log(
        "EAR:",
        left.toFixed(3),
        right.toFixed(3),
        average.toFixed(3)
    );


    /*
     * EYE STATE
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
     * Update UI immediately
     */

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
     * Calculate closed duration
     */

    const duration =
        performance.now() -
        eyesClosedSince;


    /*
     * 1.2 seconds completed
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


            console.log(
                "EYES CLOSED - WARNING"
            );


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

        hideWarning();

    }

}


/* =========================================================
   RESET
========================================================= */

function resetEyes() {

    eyesClosedSince = null;

    if (eyesClosed) {

        eyesClosed = false;

        hideWarning();

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

        console.error(
            "FaceMesh not initialized"
        );

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
                    "Face detection error:",
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
   EYE WARNING
========================================================= */

function showEyeWarning() {

    /*
     * Show text immediately
     */

    warning.textContent =
        "WAKE UP!";

    warning.className =
        "warning eye";

    warning.classList.add(
        "show"
    );


    /*
     * Play sound
     */

    playEyeAudio();

}


/* =========================================================
   HIDE WARNING
========================================================= */

function hideWarning() {

    warning.classList.remove(
        "show"
    );

    warning.className =
        "warning";

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

        console.log(
            "Audio cooldown"
        );

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
   PLAY AUDIO
========================================================= */

async function playAudio(audio) {

    if (!audio) {

        console.error(
            "Audio element not found"
        );

        return;

    }


    try {

        console.log(
            "Playing audio:",
            audio.src
        );


        audio.pause();

        audio.currentTime = 0;

        audio.muted = false;

        audio.volume = 1;


        await audio.play();


        console.log(
            "Audio playing"
        );


    } catch (error) {

        console.error(
            "Audio PLAY ERROR:",
            error
        );


        /*
         * If browser blocked it,
         * try after user interaction
         */

        audioUnlocked = false;

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

function initialize() {

    console.log(
        "Smart Study Monitor loading..."
    );


    /*
     * Initialize MediaPipe
     */

    initializeFaceMesh();


    console.log(
        "FaceMesh ready"
    );

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


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

        }


        clearTimeout(
            eyeAudioTimer
        );

    }
);