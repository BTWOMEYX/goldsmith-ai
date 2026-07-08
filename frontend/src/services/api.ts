import axios from "axios";

console.log("✅ api.ts loaded");

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});