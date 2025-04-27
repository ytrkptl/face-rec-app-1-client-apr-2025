import * as faceapi from "face-api.js";

// Path to the models - adjust this based on where you'll store the models
const MODEL_URL = "/models";

// Load all required face-api.js models
export const loadModels = async () => {
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("Face detection models loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading face detection models:", error);
    return false;
  }
};

// Detect faces in an image
export const detectFaces = async (imageElement) => {
  try {
    // Detect all faces with landmarks
    const detections = await faceapi
      .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
      .withFaceLandmarks();

    // Convert detections to the format expected by your app
    return detections.map((detection) => {
      const box = detection.detection.box;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      };
    });
  } catch (error) {
    console.error("Error detecting faces:", error);
    return [];
  }
};
