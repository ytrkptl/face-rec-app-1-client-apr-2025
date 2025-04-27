import { useState, useEffect, useRef } from "react";
import "./Profile.css";
import { useDispatch, useSelector } from "react-redux";
import {
  selectUserEmail,
  selectUserEntries,
  selectUserName,
  selectUserUid,
  selectUserJoined,
  selectUserPet,
  selectUserAge,
  selectUserHandle,
  selectUserProfilePhotoUrl
} from "@/redux/user/user.selectors";
import { updateUser } from "@/redux/user/user.actions";
import { updateUserProfile, logToFirestore, uploadImageToFirebaseStorage } from "@/services/firebase.utils";
import { updateProfileOpen } from "@/redux/app/app.actions";
import { selectIsProfileOpen } from "@/redux/app/app.selectors";

// convert to functional component
const Profile = () => {
  const userUid = useSelector(selectUserUid);
  const userName = useSelector(selectUserName);
  const userEmail = useSelector(selectUserEmail);
  const userEntries = useSelector(selectUserEntries);
  const userJoined = useSelector(selectUserJoined);
  const userPet = useSelector(selectUserPet);
  const userAge = useSelector(selectUserAge);
  const userHandle = useSelector(selectUserHandle);
  const profilePhotoUrl = useSelector(selectUserProfilePhotoUrl);
  const profileOpen = useSelector(selectIsProfileOpen);
  const dispatch = useDispatch();

  const [profileState, setProfileState] = useState({
    name: userName,
    age: userAge,
    pet: userPet,
    handle: userHandle,
    url: profilePhotoUrl
  });

  const { name, age, pet, handle, url } = profileState;

  useEffect(() => {
    // if the profile photo url is from avatar-letter.fun/api
    // then we need to change the url to the large version of the photo
    // so it looks better in the profile modal
    if (url.includes("avatar-letter.fun/api")) {
      if (profileOpen) {
        // replace the big word with large
        const url2 = url.replace("big", "large");
        setProfileState((prevState) => ({ ...prevState, url: url2 }));
      } else {
        // replace the large word with big
        const url2 = url.replace("large", "big");
        setProfileState((prevState) => ({ ...prevState, url: url2 }));
      }
    }

    return () => {
      setProfileState((prevState) => prevState);
    };
  }, [profileOpen, url]);

  const onFormChange = (event) => {
    const { name, value } = event.target;
    const nameSubstring = name.split("-")[1];

    setProfileState((prevState) => ({
      ...prevState,
      [nameSubstring]: value
    }));
  };

  const onProfileUpdate = async (data) => {
    try {
      const profileObj = {
        uid: userUid,
        displayName: data.name,
        email: userEmail,
        entries: userEntries,
        joined: userJoined,
        pet: data.pet,
        age: data.age,
        handle: data.handle,
        profilePhotoUrl: data.url,
        updatedAt: new Date().toISOString()
      };
      // update the name, age, pet, and handle in firestore
      await updateUserProfile(userUid, profileObj);
      // update the user in redux
      dispatch(updateUser(profileObj));
      dispatch(updateProfileOpen(false));
    } catch (error) {
      // if (NODE_ENV === "development") {
      // 	console.log(`error updating user profile`, error.message);
      // }
    }
  };

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef(null);

  // Handle file selection from native file input
  const handleFileChange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      // Process the selected file
      await processFile(file);
    } catch (error) {
      console.log(`Error processing selected file:`, error.message);
      const errorInfo = {
        message: error.message || "Unknown error",
        stack: error.stack || "",
        name: error.name || "Error"
      };
      await logToFirestore("Failed to process profile photo", "error", { error: errorInfo });
    }
  };

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

      // Process the file
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
      await logToFirestore("Failed to fetch profile photo from URL", "error", { error: errorInfo });
    }
  };

  // Process the file to create a resized profile photo and upload to Firebase
  const processFile = async (file) => {
    try {
      // Create a canvas to resize the image
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Create a promise to handle the async image loading
      const processAndUpload = new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Set canvas dimensions to 200x200 for profile photo
            canvas.width = 200;
            canvas.height = 200;

            // Calculate dimensions to maintain aspect ratio while covering the square
            const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
            const x = canvas.width / 2 - (img.width / 2) * scale;
            const y = canvas.height / 2 - (img.height / 2) * scale;

            // Draw the image on the canvas with the calculated dimensions
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            // Convert canvas to blob
            canvas.toBlob(
              async (blob) => {
                try {
                  // Create a file from the blob
                  const resizedFile = new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" });

                  // Upload the resized image to Firebase Storage
                  const downloadUrl = await uploadImageToFirebaseStorage(resizedFile);

                  // Generate a handle for identification
                  const handle = Math.random().toString(36).substring(2, 15);

                  // Update the profile state with the Firebase URL
                  setProfileState({ ...profileState, url: downloadUrl, handle });

                  // Resolve the promise
                  resolve();
                } catch (blobError) {
                  reject(blobError);
                }
              },
              "image/jpeg",
              0.9
            );
          } catch (canvasError) {
            reject(canvasError);
          }
        };

        img.onerror = (err) => {
          reject(new Error("Failed to load image: " + err));
        };
      });

      // Load the image from the file
      img.src = URL.createObjectURL(file);

      // Wait for the processing and upload to complete
      await processAndUpload;

      // Clean up the object URL
      URL.revokeObjectURL(img.src);
    } catch (error) {
      console.error("Error processing file:", error);
      throw error; // Re-throw to be caught by the caller
    }
  };

  // Trigger photo change options
  const triggerPhotoChange = () => {
    // Show options for uploading a photo
    setShowUrlInput(!showUrlInput);
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const closeModal = () => {
    dispatch(updateProfileOpen(false));
  };

  return (
    <div className="profile-modal">
      <article className="responsive">
        <main className="main">
          <div className="centerThatDiv">
            <img
              src={url}
              name="user-photo"
              className="avatarImageInProfile"
              alt="avatar"
            />
            <div className="profilePhotoOptions">
              <button
                className="changePhotoButton"
                onClick={triggerFileInput}>
                Upload from Device
              </button>
              <button
                className="changePhotoButton"
                onClick={() => setShowUrlInput(!showUrlInput)}>
                Upload from URL
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

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
          <h1>{name}</h1>
          <h4>{`Images Submitted: ${userEntries}`}</h4>
          <p>{`Member since: ${userJoined}`}</p>
          <hr />
          <label
            className="labelForUsername"
            htmlFor="user-name">
            Name:{" "}
          </label>
          <input
            onChange={onFormChange}
            className="inputClasses"
            placeholder={name}
            type="text"
            name="user-name"
            id="user-name"
          />
          <label
            className="otherLabels"
            htmlFor="user-age">
            Age:{" "}
          </label>
          <input
            onChange={onFormChange}
            className="inputClasses"
            placeholder={age}
            type="text"
            name="user-age"
            id="user-age"
          />
          <label
            className="otherLabels"
            htmlFor="user-pet">
            Pet:{" "}
          </label>
          <input
            onChange={onFormChange}
            className="inputClasses"
            placeholder={pet}
            type="text"
            name="user-pet"
            id="user-pet"
          />
          <div className="saveAndCancelButtonsDiv">
            <button
              onClick={() => onProfileUpdate({ name, age, pet, url, handle })}
              className="saveButton">
              Save
            </button>
            <button
              className="cancelButton"
              onClick={closeModal}>
              Cancel
            </button>
          </div>
        </main>
        <div
          className="modal-close"
          onClick={closeModal}>
          &times;
        </div>
      </article>
    </div>
  );
};

export default Profile;
