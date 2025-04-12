import React from "react";
import ReactDOM from "react-dom/client";
import timelineItems from "./timelineItems.js";
import Timeline from "./Timeline";
import "./app.css";

function App() {
  return (
    <div className="app">
      <h1>Timeline Visualization</h1>
      <Timeline items={timelineItems} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);