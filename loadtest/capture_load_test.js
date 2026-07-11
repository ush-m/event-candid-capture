import http from "k6/http";
import { check, sleep } from "k6";
import { uuid } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5173";
const SUPABASE_URL = __ENV.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const EVENT_ID = __ENV.EVENT_ID || "";

export const options = {
  scenarios: {
    guest_capture: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },   // Ramp up to 50 concurrent guests
        { duration: "1m", target: 100 },    // Ramp to 100
        { duration: "2m", target: 200 },    // Ramp to 200 (target concurrency)
        { duration: "1m", target: 200 },    // Hold at 200
        { duration: "30s", target: 0 },     // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],  // 95% of requests under 500ms
    http_req_failed: ["rate<0.05"],     // Less than 5% failure rate
  },
};

function createSession() {
  const payload = JSON.stringify({
    event_id: EVENT_ID,
    contact_method: "phone",
    contact_value: `+1555${String(__VU).padStart(7, "0")}`,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/create-session`,
    payload,
    params
  );

  check(res, {
    "session created": (r) => r.status === 200 || r.status === 201,
    "has session_id": (r) => {
      try {
        return JSON.parse(r.body).session_id !== undefined;
      } catch {
        return false;
      }
    },
  });

  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

function simulateCapture(sessionId) {
  // Simulate capturing a photo (just test the endpoint with minimal payload)
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("media_id", uuid());
  formData.append("media_type", "photo");
  formData.append("captured_at", new Date().toISOString());

  // Create a minimal test blob (1x1 pixel JPEG)
  const testBlob = new Blob(
    [new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])],
    { type: "image/jpeg" }
  );
  formData.append("file", testBlob, "test.jpg");

  const params = {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/upload-media`,
    formData,
    params
  );

  check(res, {
    "upload success": (r) => r.status === 200,
  });

  return res.status === 200;
}

export default function () {
  if (!EVENT_ID || !SUPABASE_URL) {
    console.error("Set EVENT_ID and SUPABASE_URL environment variables");
    return;
  }

  // Step 1: Create session
  const session = createSession();
  if (!session?.session_id) return;

  sleep(1);

  // Step 2: Simulate a few captures
  const captureCount = Math.floor(Math.random() * 5) + 1;
  for (let i = 0; i < captureCount; i++) {
    simulateCapture(session.session_id);
    sleep(0.5); // Simulate time between captures
  }

  // Step 3: Wait (simulating event duration)
  sleep(Math.random() * 5 + 2);
}
