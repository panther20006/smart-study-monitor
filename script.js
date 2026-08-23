/* =========================================================
   SMART STUDY MONITOR
   COMPLETE JAVASCRIPT
   EYE + PHONE + AUDIO
========================================================= */


/* =========================================================
   ELEMENTS
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

    /* Eyes closed continuously */
    eyeClosedDuration: 1200,

    /*
     * EAR threshold.
     * If eyes are not detecting correctly,
     * try 0.22 or 0.23.
     */
    eyeThreshold: 0.21,

    /* Face detection interval */
    eyeDetectionInterval: 80,

    /* Phone confidence */
    phoneConfidence: 0.55,

    /* Phone detection interval */
    phoneDetectionInterval: 700,

    /* Audio cooldown */
    audioCooldown: 5000
};


/* =========================================================
   STATE
========================================================= */

let cameraStream = null;

let faceMesh = null;
let phoneModel = null;

let faceLoopRunning = false;
let phoneLoopRunning = false;

let phoneDetecting = false;

let eyesClosedSince = null;

let eyesClosed = false;
let phoneDetected = false;

let lastEyeAudio = 0;
let lastPhoneAudio = 0;

let started = false;


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    console.log(
        "Smart Study Monitor initializing..."
    );

    /*
     * Check required elements
     */

    if (!video) {
        console.error("Video element missing");
        return;
    }

    if (!startBtn) {
        console.error("Start button missing");
        return;
    }

    if (!eyeAudio) {
        console.error("eye.mp3 audio element missing");
    }

    if (!phoneAudio) {
        console.error("phone.mp3 audio element missing");
    }


    /*
     * Prepare Face Mesh
     */

    initializeFaceMesh();


    /*
     * Start button
     */

    startBtn.addEventListener(
        "click",
        startMonitoring
    );


    console.log(
        "Ready. Click START MONITORING."
    );
}


/* =========================================================
   START MONITORING
========================================================= */

async function startMonitoring() {

    /*
     * Prevent double click
     */

    if (started) {
        return;
    }

    started = true;


    console.log(
        "Starting monitoring..."
    );


    /*
     * Change button
     */

    startBtn.textContent =
        "STARTING...";

    startBtn.disabled = true;


    /*
     * Unlock audio FIRST
     *
     * Important for Chrome/GitHub Pages
     */

    await unlockAudio();


    /*
     * Start camera
     */

    const cameraStarted =
        await startCamera();


    /*
     * Camera failed
     */

    if (!cameraStarted) {

        started = false;

        startBtn.disabled = false;

        startBtn.textContent =
            "▶ START MONITORING";

        return;
    }


    /*
     * Camera started
     */

    startBtn.textContent =
        "✓ MONITORING ACTIVE";

    startBtn.classList.add(
        "active"
    );


    /*
     * Hide button
     */

    setTimeout(() => {

        startBtn.style.display =
            "none";

    }, 1000);


    /*
     * Start phone model
     *
     * It loads in background.
     */

    loadPhoneModel();

}


/* =========================================================
   UNLOCK AUDIO
========================================================= */

async function unlockAudio() {

    console.log(
        "Unlocking audio..."
    );


    /*
     * EYE AUDIO
     */

    if (eyeAudio) {

        try {

            eyeAudio.muted = true;

            eyeAudio.volume = 1;

            eyeAudio.currentTime = 0;

            await eyeAudio.play();

            eyeAudio.pause();

            eyeAudio.currentTime = 0;

            eyeAudio.muted = false;

        } catch (error) {

            console.warn(
                "Eye audio unlock:",
                error
            );

            eyeAudio.muted = false;
        }
    }


    /*
     * PHONE AUDIO
     */

    if (phoneAudio) {

        try {

            phoneAudio.muted = true;

            phoneAudio.volume = 1;

            phoneAudio.currentTime = 0;

            await phoneAudio.play();

            phoneAudio.pause();

            phoneAudio.currentTime = 0;

            phoneAudio.muted = false;

        } catch (error) {

            console.warn(
                "Phone audio unlock:",
                error
            );

            phoneAudio.muted = false;
        }
    }


    console.log(
        "Audio ready."
    );
}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    console.log(
        "Requesting camera..."
    );


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showCameraError(
            "Camera API is not available. Open the website using HTTPS."
        );

        return false;
    }


    try {

        /*
         * Request webcam
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


        console.log(
            "Camera permission granted."
        );


        /*
         * Attach camera
         */

        video.srcObject =
            cameraStream;


        /*
         * Wait for video
         */

        await waitForVideo();


        /*
         * Play
         */

        try {

            await video.play();

        } catch (error) {

            console.warn(
                "Video play:",
                error
            );

        }


        /*
         * Canvas size
         */

        canvas.width =
            video.videoWidth || 640;

        canvas.height =
            video.videoHeight || 480;


        /*
         * Hide camera message
         */

        if (cameraMessage) {

            cameraMessage.classList.remove(
                "show"
            );

        }


        console.log(
            "Camera started successfully."
        );


        /*
         * Start eye detection
         */

        startFaceDetection();


        return true;


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        let message =
            "Camera start nahi hua.";


        if (
            error.name ===
            "NotAllowedError"
        ) {

            message =
                "Camera permission Allow karo.";

        }


        else if (
            error.name ===
            "NotFoundError"
        ) {

            message =
                "Camera device nahi mila.";

        }


        else if (
            error.name ===
            "NotReadableError"
        ) {

            message =
                "Camera kisi aur app me use ho raha hai.";

        }


        else if (
            error.name ===
            "SecurityError"
        ) {

            message =
                "HTTPS required hai.";

        }


        showCameraError(
            message
        );


        return false;
    }
}


/* =========================================================
   WAIT FOR VIDEO
========================================================= */

function waitForVideo() {

    return new Promise(
        resolve => {

            /*
             * Already ready
             */

            if (
                video.readyState >= 2 &&
                video.videoWidth > 0
            ) {

                resolve();

                return;
            }


            /*
             * Metadata event
             */

            video.onloadedmetadata = () => {

                resolve();

            };


            /*
             * Safety timeout
             */

            setTimeout(
                () => {

                    resolve();

                },
                5000
            );

        }
    );
}


/* =========================================================
   CAMERA ERROR
========================================================= */

function showCameraError(
    message
) {

    if (cameraMessage) {

        cameraMessage.textContent =
            message;

        cameraMessage.classList.add(
            "show"
        );

    }


    console.error(
        message
    );

}


/* =========================================================
   MEDIAPIPE FACE MESH
========================================================= */

function initializeFaceMesh() {

    /*
     * Check library
     */

    if (
        typeof FaceMesh ===
        "undefined"
    ) {

        console.error(
            "MediaPipe FaceMesh library not loaded."
        );

        return;
    }


    console.log(
        "Initializing Face Mesh..."
    );


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


    console.log(
        "Face Mesh ready."
    );
}


/* =========================================================
   FACE RESULTS
========================================================= */

function handleFaceResults(
    results
) {

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
            "waiting";


        resetEyes();


        return;
    }


    /*
     * Get first face
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
        (
            left +
            right
        ) / 2;


    /*
     * Display EAR
     */

    leftEAR.textContent =
        left.toFixed(3);

    rightEAR.textContent =
        right.toFixed(3);

    averageEAR.textContent =
        average.toFixed(3);


    /*
     * Check eye state
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
        distance(
            p2,
            p6
        );


    const vertical2 =
        distance(
            p3,
            p5
        );


    const horizontal =
        distance(
            p1,
            p4
        );


    if (
        horizontal <= 0
    ) {

        return 1;

    }


    return (
        (
            vertical1 +
            vertical2
        ) /
        (
            2 *
            horizontal
        )
    );

}


/* =========================================================
   DISTANCE
========================================================= */

function distance(
    a,
    b
) {

    const dx =
        a.x -
        b.x;

    const dy =
        a.y -
        b.y;


    return Math.sqrt(
        (
            dx * dx
        ) +
        (
            dy * dy
        )
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
     * Show closing
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
     * 1.2 seconds
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


            /*
             * Warning
             */

            showEyeWarning();

        }

    }

}


/* =========================================================
   EYES OPEN
========================================================= */

function handleEyesOpen() {

    eyesClosedSince =
        null;


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

    eyesClosedSince =
        null;

    eyesClosed =
        false;

    /*
     * Don't hide phone warning
     */

    updateWarning();

}


/* =========================================================
   FACE DETECTION LOOP
========================================================= */

async function startFaceDetection() {

    if (
        faceLoopRunning
    ) {

        return;

    }


    if (!faceMesh) {

        console.error(
            "Face Mesh not ready."
        );

        return;
    }


    faceLoopRunning =
        true;


    console.log(
        "Eye detection started."
    );


    while (
        faceLoopRunning
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
   PHONE MODEL
========================================================= */

async function loadPhoneModel() {

    if (phoneModel) {

        startPhoneDetection();

        return;
    }


    if (
        typeof cocoSsd ===
        "undefined"
    ) {

        console.error(
            "COCO-SSD library not loaded."
        );

        return;
    }


    try {

        console.log(
            "Loading phone detection AI..."
        );


        phoneModel =
            await cocoSsd.load();


        console.log(
            "Phone detection AI ready."
        );


        startPhoneDetection();


    } catch (error) {

        console.error(
            "Phone model loading error:",
            error
        );

    }

}


/* =========================================================
   PHONE DETECTION LOOP
========================================================= */

async function startPhoneDetection() {

    if (
        phoneLoopRunning
    ) {

        return;

    }


    if (!phoneModel) {

        return;

    }


    phoneLoopRunning =
        true;


    console.log(
        "Phone detection started."
    );


    while (
        phoneLoopRunning
    ) {

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
   DETECT PHONE
========================================================= */

async function detectPhone() {

    if (
        !phoneModel ||
        phoneDetecting
    ) {

        return;

    }


    phoneDetecting =
        true;


    try {

        /*
         * Canvas
         */

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;


        /*
         * Camera frame
         */

        ctx.drawImage(

            video,

            0,
            0,

            canvas.width,
            canvas.height

        );


        /*
         * AI prediction
         */

        const predictions =
            await phoneModel.detect(
                canvas
            );


        /*
         * Search phone
         */

        const foundPhone =
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

        if (
            foundPhone
        ) {

            if (
                !phoneDetected
            ) {

                phoneDetected =
                    true;


                console.log(
                    "📱 PHONE DETECTED"
                );


                showPhoneWarning();

            }

        }


        /*
         * PHONE REMOVED
         */

        else {

            if (
                phoneDetected
            ) {

                phoneDetected =
                    false;


                console.log(
                    "Phone removed"
                );


                updateWarning();

            }

        }


    } catch (error) {

        console.warn(
            "Phone detection error:",
            error
        );

    }


    phoneDetecting =
        false;

}


/* =========================================================
   EYE WARNING
========================================================= */

function showEyeWarning() {

    /*
     * Show text immediately
     */

    updateWarning();


    /*
     * Play audio
     */

    playEyeAudio();

}


/* =========================================================
   PHONE WARNING
========================================================= */

function showPhoneWarning() {

    /*
     * Show text immediately
     */

    updateWarning();


    /*
     * Play audio
     */

    playPhoneAudio();

}


/* =========================================================
   WARNING MANAGER
========================================================= */

function updateWarning() {

    /*
     * Phone has priority
     */

    if (
        phoneDetected
    ) {

        setWarning(
            "PUT THE PHONE AWAY!",
            "phone"
        );

        return;
    }


    /*
     * Eye warning
     */

    if (
        eyesClosed
    ) {

        setWarning(
            "WAKE UP!",
            "eye"
        );

        return;
    }


    /*
     * Nothing
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

    warning.textContent =
        text;


    warning.className =
        "warning " +
        type;


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

    if (!eyeAudio) {

        console.error(
            "eyeAudio element missing."
        );

        return;
    }


    const now =
        Date.now();


    /*
     * Cooldown
     */

    if (
        now -
        lastEyeAudio <
        SETTINGS.audioCooldown
    ) {

        return;
    }


    lastEyeAudio =
        now;


    console.log(
        "🔊 Playing eye.mp3"
    );


    try {

        eyeAudio.pause();

        eyeAudio.currentTime =
            0;

        eyeAudio.volume =
            1;

        eyeAudio.muted =
            false;


        const playPromise =
            eyeAudio.play();


        if (
            playPromise
        ) {

            playPromise
                .then(() => {

                    console.log(
                        "✓ eye.mp3 playing"
                    );

                })
                .catch(error => {

                    console.error(
                        "❌ eye.mp3 blocked:",
                        error
                    );

                });

        }


    } catch (error) {

        console.error(
            "Eye audio error:",
            error
        );

    }

}


/* =========================================================
   PHONE AUDIO
========================================================= */

function playPhoneAudio() {

    if (!phoneAudio) {

        console.error(
            "phoneAudio element missing."
        );

        return;
    }


    const now =
        Date.now();


    /*
     * Cooldown
     */

    if (
        now -
        lastPhoneAudio <
        SETTINGS.audioCooldown
    ) {

        return;
    }


    lastPhoneAudio =
        now;


    console.log(
        "🔊 Playing phone.mp3"
    );


    try {

        phoneAudio.pause();

        phoneAudio.currentTime =
            0;

        phoneAudio.volume =
            1;

        phoneAudio.muted =
            false;


        const playPromise =
            phoneAudio.play();


        if (
            playPromise
        ) {

            playPromise
                .then(() => {

                    console.log(
                        "✓ phone.mp3 playing"
                    );

                })
                .catch(error => {

                    console.error(
                        "❌ phone.mp3 blocked:",
                        error
                    );

                });

        }


    } catch (error) {

        console.error(
            "Phone audio error:",
            error
        );

    }

}


/* =========================================================
   SLEEP
========================================================= */

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


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        faceLoopRunning =
            false;

        phoneLoopRunning =
            false;


        if (
            cameraStream
        ) {

            cameraStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

        }

    }
);


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