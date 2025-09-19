import React, { useState } from 'react';
import './ContestPage.css';

// Mock data to have some initial content. You can remove this.
const initialSubmissions = [
  { id: 1, imageSrc: 'https://th.bing.com/th/id/OIP._l1kbbSIBSehKVsGAN7vewHaK0?w=206&h=302&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3', likes: 23 },
  { id: 2, imageSrc: 'https://th.bing.com/th/id/OIP.NwdOych66mG8TJLPXkTHZwHaLH?w=204&h=306&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3', likes: 15 },
  { id: 3, imageSrc: 'https://th.bing.com/th/id/OIP.g3IA0rmUgVWDhyfUoigFRgHaK5?w=206&h=303&c=7&r=0&o=5&dpr=1.3&pid=1.7', likes: 42 },
];


const ContestPage = () => {
  // State to hold the list of submitted looks
  const [submissions, setSubmissions] = useState(initialSubmissions);
  // State to hold the file selected by the user for upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

  // Handle file selection from the input
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Handle the "Upload" button click
  const handleUpload = () => {
    if (!selectedFile) {
      alert("Please select an image to upload.");
      return;
    }

    // Create a new submission object
    const newSubmission = {
      id: Date.now(), // Use a timestamp for a unique key
      imageSrc: URL.createObjectURL(selectedFile),
      likes: 0,
    };

    // Add the new submission to the top of the list
    setSubmissions([newSubmission, ...submissions]);

    // Reset the input fields
    setSelectedFile(null);
    setPreview(null);
  };

  // Handle clicking the "Like" button on a submission
  const handleLike = (id) => {
    setSubmissions(
      submissions.map((sub) =>
        sub.id === id ? { ...sub, likes: sub.likes + 1 } : sub
      )
    );
  };

  return (
    <div className="contest-container">
      <div className="contest-header">
        <h1>Myntra Style Contest ✨</h1>
        <p>Showcase your unique style, get likes, and earn stars!</p>
      </div>

      <div className="upload-section">
        <label htmlFor="file-upload" className="upload-box">
          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            "Click to select your style combination"
          )}
        </label>
        <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} />
        <button onClick={handleUpload} className="upload-btn" disabled={!selectedFile}>
          Submit My Look
        </button>
      </div>

      <div className="submissions-grid">
        {submissions.map((sub) => (
          <div key={sub.id} className="submission-card">
            <img src={sub.imageSrc} alt={`Style submission ${sub.id}`} className="submission-image" />
            <div className="card-footer">
              <button onClick={() => handleLike(sub.id)} className="like-button">
                ❤️
              </button>
              <span className="like-count">{sub.likes} Stars ⭐</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rules-section">
        <h2>Contest Rules</h2>
        <ul>
          <li>All submissions must be original style combinations.</li>
          <li>Upload a clear, high-quality image of your full outfit.</li>
          <li>Likes from other users will be converted to stars.</li>
          <li>This is a fun, frontend-only contest. All submissions will be cleared on page refresh.</li>
        </ul>
      </div>
    </div>
  );
};

export default ContestPage;