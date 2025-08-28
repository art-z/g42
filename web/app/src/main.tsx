// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import {createBrowserRouter, RouterProvider} from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Rounds from "./pages/Rounds";
import Round from "./pages/Round";
import "./styles.css";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App/>,
        children: [
            {index: true, element: <Login/>},
            {path: "rounds", element: <Rounds/>},
            {path: "rounds/:id", element: <Round/>},
        ],
    },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>
);
