import React, { useState, useEffect } from "react";
import CryptoJS from "crypto-js";

const App = () => {
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    userId: "",
    email: "",
    browser: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [token, setToken] = useState("");
  const [step, setStep] = useState(1);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now.toISOString().split("T")[0]);
    setCurrentTime(now.toTimeString().split(" ")[0].slice(0, 5));
    setFormData((prev) => ({ ...prev, browser: navigator.userAgent }));

    const mobileCheck = /Mobi|Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent
    );
    setIsMobileOrTablet(mobileCheck);
    if (mobileCheck) return;

    const submissionData = JSON.parse(
      localStorage.getItem("attendanceSubmission")
    );
    if (submissionData) {
      const hoursDifference =
        (now - new Date(submissionData.timestamp)) / (1000 * 60 * 60);
      if (hoursDifference < 24) setIsSubmitted(true);
    }
  }, []);

  const logEvent = async (event, details) => {
    try {
      await fetch(`http://${window.location.hostname}:8088/logEvent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          details,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error logging event:", error);
    }
  };

  const generateToken = (name, email) =>
    CryptoJS.SHA256(name + email)
      .toString(CryptoJS.enc.Hex)
      .slice(0, 8);

  const fetchStudentData = async (userId) => {
    if (!userId) return;
    logEvent("Student Lookup", { userId });
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8088/getStudent/${userId}`
      );
      const data = await response.json();
      if (response.ok) {
        setFormData({
          name: data.name,
          email: data.email,
          userId: data.userId,
        });
        setToken(generateToken(data.name, data.email));
        setStep(2);
      } else {
        alert("Student not found");
        logEvent("Student Not Found", { userId });
      }
    } catch (error) {
      logEvent("Error Fetching Student", { userId, error: error.message });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      date: currentDate,
      time: currentTime,
      token,
    };
    logEvent("Attendance Submission Attempt", submissionData);
    try {
      const response = await fetch(
        `http://${window.location.hostname}:8088/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submissionData),
        }
      );
      const result = await response.json();

      if (response.status === 201) {
        alert(result.message);
        logEvent("Alert Shown", { message: result.message });
        localStorage.setItem(
          "attendanceSubmission",
          JSON.stringify({ timestamp: new Date().toISOString() })
        );
        setIsSubmitted(true);
      } else if (response.status === 409) {
        setFlagged(true);
      } else if (response.status === 200) {
        alert("You have already submitted the form");
        setIsSubmitted(true);
      }
    } catch (error) {
      logEvent("Error Submitting Attendance", { error: error.message });
      alert("You have already submitted your attendance today!");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "userId" ? value.toLowerCase() : value,
    }));
  };

  return (
    <div className="container">
      <div className="wrapper">
        <div className="title">
          <span>Student Attendance</span>
        </div>
        {isMobileOrTablet ? (
          <p className="mobile-restriction">
            This form is not accessible on mobile or tablet devices. Please use
            a desktop browser.
          </p>
        ) : flagged ? (
          <div>
            <h3 align="center">*- Multiple attempts detected -* </h3>
            <h5 align="center">
              ------------------------------------------------------
            </h5>
            <h4 align="center">
              You and your accomplice will not receive today's attendance *
            </h4>
          </div>
        ) : isSubmitted ? (
          <p className="success-message" align="center">
            You have submitted your attendance for today!
          </p>
        ) : step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchStudentData(formData.userId);
            }}
          >
            <div className="row">
              <input
                type="text"
                name="userId"
                placeholder="Enter your User ID..."
                required
                onChange={handleChange}
                value={formData.userId}
              />
            </div>
            <div className="row button">
              <input type="submit" value="Next" />
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            {Object.entries(formData).map(([key, value]) => (
              <div className="row" key={key}>
                <input type="text" name={key} value={value} disabled required />
              </div>
            ))}
            <div className="row">
              <input type="date" value={currentDate} disabled required />
            </div>
            <div className="row">
              <input type="time" value={currentTime} disabled required />
            </div>
            <div className="row">
              <input type="text" name="token" value={token} disabled required />
            </div>
            <div className="row button">
              <input type="submit" value="Submit" />
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default App;
