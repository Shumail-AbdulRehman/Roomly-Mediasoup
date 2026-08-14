// import { useEffect } from "react";
import "./App.css";
// import { connectWebSocket } from "./lib/websocket";
import { Outlet } from "react-router-dom";

function App() {
  // useEffect(() => {
  //   connectWebSocket();
  // }, []);

  return (
    <>
      <Outlet />
    </>
  );
}

export default App;
