import React, { useEffect, useState } from "react";
import "./UploadButtonWithPicker.css";
import { useDispatch } from "react-redux";
import {
  uploadImageToFirebaseStorage,
  updateEntriesInFirebase,
  logToFirestore,
  saveCoordinatesInFirestore
} from "@/services/firebase.utils";
import { updateImageUrl } from "@/redux/app/app.actions";
import { updateBoxes } from "@/redux/app/app.actions";
import { useSelector } from "react-redux";
import { selectImageUrl } from "@/redux/app/app.selectors";
import { loadModels, detectFaces } from "@/services/face-api.utils";

const UploadButtonWithPicker = () => {
  const dispatch = useDispatch();
  const imageUrl = useSelector(selectImageUrl);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // Load face-api.js models on component mount
  useEffect(() => {
    loadModels();
  }, []);

  // Process an image from URL
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!urlInput) return;

    try {
      // Fetch the image from the URL
      const response = await fetch(urlInput);
      const blob = await response.blob();

      // Create a file from the blob
      const file = new File([blob], "image-from-url.jpg", { type: blob.type });

      // Process the file using the same function as local upload
      await processFile(file);

      // Reset the URL input
      setUrlInput("");
      setShowUrlInput(false);
    } catch (error) {
      console.error("Error fetching image from URL:", error);
      const errorInfo = {
        message: error.message || "Unknown error",
        stack: error.stack || "",
        name: error.name || "Error"
      };
      await logToFirestore("Failed to fetch image from URL", "error", { error: errorInfo });
    }
  };

  // Extract the file processing logic to reuse it
  const processFile = async (file) => {
    if (!file) return;

    // First, create a local object URL for the file to detect faces
    const localObjectUrl = URL.createObjectURL(file);

    // Process the selected file directly
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Set up the onload handler before setting the src
    img.onload = async () => {
      try {
        // Step 1: Detect faces using face-api.js
        console.log("Detecting faces...");
        const facesData = await detectFaces(img);

        // Step 2: Upload to Firebase and get URL
        console.log("Uploading to Firebase...");
        const downloadUrl = await uploadImageToFirebaseStorage(file);

        // Step 3: Update state with the image URL and detected faces
        console.log("Updating state...");
        dispatch(updateImageUrl(downloadUrl));
        dispatch(updateBoxes(facesData));

        // Step 4: Save to Firestore
        console.log("Saving to Firestore...");
        await Promise.all([updateEntriesInFirebase(), saveCoordinatesInFirestore(downloadUrl, facesData)]);

        // Clean up the local object URL
        URL.revokeObjectURL(localObjectUrl);
      } catch (innerError) {
        console.error("Error in image processing:", innerError.message);
        const errorInfo = {
          message: innerError.message || "Unknown error",
          stack: innerError.stack || "",
          name: innerError.name || "Error"
        };
        await logToFirestore("Failed to process image after loading", "error", { error: errorInfo });
      }
    };

    // Set the image source to the local object URL
    img.src = localObjectUrl;
  };

  // Update the file change handler to use the processFile function
  const handleFileChange = async (event) => {
    try {
      const file = event.target.files[0];
      await processFile(file);
    } catch (error) {
      console.log(`Error processing selected file:`, error.message);
      const errorInfo = {
        message: error.message || "Unknown error",
        stack: error.stack || "",
        name: error.name || "Error"
      };
      await logToFirestore("Failed to process selected file", "error", { error: errorInfo });
    }
  };

  return (
    <div className="fileUploadContainer">
      {/* Upload options */}
      <div className="uploadOptions">
        <label
          htmlFor="fileInput"
          className="uploadOption">
          <i className="fas fa-file-upload"></i>
          Upload from device
        </label>
        <button
          className="uploadOption"
          onClick={() => setShowUrlInput(!showUrlInput)}>
          <i className="fas fa-link"></i>
          Upload from URL
        </button>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        id="fileInput"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* URL input form */}
      {showUrlInput && (
        <form
          onSubmit={handleUrlSubmit}
          className="urlInputForm">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter image URL"
            required
          />
          <button type="submit">Load Image</button>
        </form>
      )}
    </div>
  );
};

export default UploadButtonWithPicker;
