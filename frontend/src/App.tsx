import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/Home/Home";
import { RoomPage } from "./pages/Room/Room";
import "./index.css";

function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
