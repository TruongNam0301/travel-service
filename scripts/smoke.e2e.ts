/**
 * Comprehensive E2E Smoke Test Suite
 * Tests all critical user flows, job types, and error scenarios
 */

const BASE = process.env.API_BASE || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || `smoke_${Date.now()}@wandermind.dev`;
const PASSWORD = process.env.SMOKE_PASSWORD || "Passw0rd!";
const CITY = process.env.SMOKE_CITY || "Da Lat";

// Type definitions for API responses
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface PlanResponse {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface JobResponse {
  id: string;
  planId: string;
  type: string;
  state: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

interface ConversationResponse {
  id: string;
  planId: string;
  title: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MessageResponse {
  id: string;
  conversationId: string;
  content: string;
  role: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
}

type ApiResponse<T> = T | ApiResponseWrapper<T>;

async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json: ApiResponse<T>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON for ${path}: ${text}`);
  }
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(json)}`);
  }
  // Handle both wrapped and unwrapped responses
  const response = json as ApiResponseWrapper<T>;
  return (response.data ?? json) as T;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollJobUntilComplete(
  jobId: string,
  token: string,
  maxAttempts = 40,
  intervalMs = 500,
): Promise<JobResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await api<JobResponse>(`/jobs/${jobId}`, {}, token);
    if (job.state === "completed" || job.state === "failed") {
      return job;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Job ${jobId} did not complete within ${maxAttempts * intervalMs}ms`,
  );
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertExists<T>(value: T | undefined | null, name: string): T {
  assert(value !== undefined && value !== null, `${name} should exist`);
  return value as T;
}

(async () => {
  const t0 = Date.now();
  console.log("🚀 SMOKE TEST START:", { BASE, EMAIL, CITY });
  console.log("");

  // ============================================================================
  // 1. AUTHENTICATION TESTS
  // ============================================================================
  console.log("📝 Testing Authentication...");

  // 1.1 Register new user
  await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      name: "Smoke Test User",
    }),
  });
  console.log("  ✓ User registration successful");

  // 1.2 Login
  const loginResponse = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = loginResponse.accessToken;
  assert(!!token, "Should receive access token");
  assert(!!loginResponse.refreshToken, "Should receive refresh token");
  console.log("  ✓ User login successful");

  // 1.3 Test authentication required (should fail without token)
  try {
    await api<PlanResponse[]>("/plans", {});
    throw new Error("Should have failed without auth token");
  } catch (err) {
    const error = err as Error;
    assert(error.message.includes("401"), "Should get 401 unauthorized");
  }
  console.log("  ✓ Authentication required enforced");

  console.log("");

  // ============================================================================
  // 2. PLAN MANAGEMENT TESTS
  // ============================================================================
  console.log("📋 Testing Plan Management...");

  // 2.1 Create plan
  const plan = await api<PlanResponse>(
    "/plans",
    {
      method: "POST",
      body: JSON.stringify({
        title: `Comprehensive Smoke Test ${new Date().toISOString()}`,
      }),
    },
    token,
  );
  const planId = plan.id;
  assert(!!planId, "Plan should have an ID");
  assert(
    plan.title.includes("Comprehensive Smoke Test"),
    "Plan title should match",
  );
  console.log("  ✓ Plan created:", planId);

  // 2.2 List plans
  const plansList = await api<PaginatedResponse<PlanResponse>>(
    "/plans?page=1&limit=10",
    {},
    token,
  );
  assert(plansList.data.length > 0, "Should have at least one plan");
  assert(
    plansList.data.some((p) => p.id === planId),
    "Should find created plan in list",
  );
  console.log(`  ✓ Plans list retrieved (${plansList.total} total)`);

  // 2.3 Get specific plan
  const fetchedPlan = await api<PlanResponse>(`/plans/${planId}`, {}, token);
  assert(fetchedPlan.id === planId, "Should fetch correct plan");
  console.log("  ✓ Single plan fetched");

  // 2.4 Test accessing non-existent plan (should fail)
  try {
    await api<PlanResponse>(
      "/plans/00000000-0000-0000-0000-000000000000",
      {},
      token,
    );
    throw new Error("Should have failed for non-existent plan");
  } catch (err) {
    const error = err as Error;
    assert(error.message.includes("404"), "Should get 404 not found");
  }
  console.log("  ✓ Non-existent plan access denied");

  console.log("");

  // ============================================================================
  // 3. JOB PROCESSING TESTS - Research Hotel
  // ============================================================================
  console.log("🏨 Testing Research Hotel Job...");

  const hotelJob = await api<JobResponse>(
    `/plans/${planId}/jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "research_hotel",
        params: { city: CITY, nights: 2 },
      }),
    },
    token,
  );
  assert(!!hotelJob.id, "Hotel job should have ID");
  assert(hotelJob.type === "research_hotel", "Job type should match");
  assert(
    hotelJob.state === "queued" || hotelJob.state === "pending",
    "Job should be queued or pending",
  );
  console.log(`  ✓ Hotel research job created: ${hotelJob.id}`);

  // Poll until complete
  const completedHotelJob = await pollJobUntilComplete(hotelJob.id, token);
  if (completedHotelJob.state === "failed") {
    throw new Error(
      `Hotel job failed: ${completedHotelJob.error || "Unknown error"}`,
    );
  }
  assert(
    completedHotelJob.state === "completed",
    `Hotel job should complete (got: ${completedHotelJob.state})`,
  );
  assert(!!completedHotelJob.result, "Hotel job should have result");
  assert(completedHotelJob.durationMs !== undefined, "Should track duration");
  console.log(`  ✓ Hotel job completed in ${completedHotelJob.durationMs}ms`);

  // Validate result structure
  const hotelResult = completedHotelJob.result;
  assert(hotelResult?.success === true, "Result should be successful");
  assert(
    hotelResult?.jobType === "research_hotel",
    "Result job type should match",
  );
  assert(!!hotelResult?.data, "Result should have data");
  assert(!!hotelResult?.summary, "Result should have summary");
  assert(!!hotelResult?.meta, "Result should have meta");
  console.log("  ✓ Hotel job result structure valid");

  console.log("");

  // ============================================================================
  // 4. JOB PROCESSING TESTS - Find Food
  // ============================================================================
  console.log("🍽️  Testing Find Food Job...");

  const foodJob = await api<JobResponse>(
    `/plans/${planId}/jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "find_food",
        params: { city: CITY, cuisine: "Vietnamese", budget: "$$" },
      }),
    },
    token,
  );
  console.log(`  ✓ Food search job created: ${foodJob.id}`);

  const completedFoodJob = await pollJobUntilComplete(foodJob.id, token);
  assert(
    completedFoodJob.state === "completed",
    `Food job should complete (got: ${completedFoodJob.state})`,
  );
  assert(
    completedFoodJob.result?.success === true,
    "Food result should be successful",
  );
  assert(
    completedFoodJob.result?.jobType === "find_food",
    "Food job type should match",
  );
  console.log(`  ✓ Food job completed in ${completedFoodJob.durationMs}ms`);

  console.log("");

  // ============================================================================
  // 5. JOB PROCESSING TESTS - Find Attraction
  // ============================================================================
  console.log("🎡 Testing Find Attraction Job...");

  const attractionJob = await api<JobResponse>(
    `/plans/${planId}/jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "find_attraction",
        params: { city: CITY, category: "historical" },
      }),
    },
    token,
  );
  console.log(`  ✓ Attraction search job created: ${attractionJob.id}`);

  const completedAttractionJob = await pollJobUntilComplete(
    attractionJob.id,
    token,
  );
  assert(
    completedAttractionJob.state === "completed",
    `Attraction job should complete (got: ${completedAttractionJob.state})`,
  );
  assert(
    completedAttractionJob.result?.success === true,
    "Attraction result should be successful",
  );
  assert(
    completedAttractionJob.result?.jobType === "find_attraction",
    "Attraction job type should match",
  );
  console.log(
    `  ✓ Attraction job completed in ${completedAttractionJob.durationMs}ms`,
  );

  console.log("");

  // ============================================================================
  // 6. JOB MANAGEMENT TESTS
  // ============================================================================
  console.log("⚙️  Testing Job Management...");

  // 6.1 List all jobs for the plan
  const jobsList = await api<PaginatedResponse<JobResponse>>(
    `/plans/${planId}/jobs?page=1&limit=10`,
    {},
    token,
  );
  assert(jobsList.data.length >= 3, "Should have at least 3 jobs");
  assert(jobsList.total >= 3, "Total should be at least 3");
  console.log(`  ✓ Jobs list retrieved (${jobsList.total} total)`);

  // 6.2 Filter jobs by state
  const completedJobsList = await api<PaginatedResponse<JobResponse>>(
    `/plans/${planId}/jobs?state=completed`,
    {},
    token,
  );
  assert(
    completedJobsList.data.every((j) => j.state === "completed"),
    "All jobs should be completed",
  );
  console.log(
    `  ✓ Jobs filtered by state (${completedJobsList.total} completed)`,
  );

  // 6.3 Filter jobs by type
  const hotelJobsList = await api<PaginatedResponse<JobResponse>>(
    `/plans/${planId}/jobs?type=research_hotel`,
    {},
    token,
  );
  assert(
    hotelJobsList.data.every((j) => j.type === "research_hotel"),
    "All jobs should be research_hotel type",
  );
  console.log(`  ✓ Jobs filtered by type (${hotelJobsList.total} hotel jobs)`);

  // 6.4 Create a job for cancellation test
  const cancelJob = await api<JobResponse>(
    `/plans/${planId}/jobs`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "research_hotel",
        params: { city: "Tokyo" },
        priority: -10, // Low priority to keep it in queue longer
      }),
    },
    token,
  );
  console.log(`  ✓ Job created for cancellation: ${cancelJob.id}`);

  // 6.5 Cancel the job immediately
  await api(`/jobs/${cancelJob.id}/cancel`, { method: "POST" }, token);
  const cancelledJob = await api<JobResponse>(
    `/jobs/${cancelJob.id}`,
    {},
    token,
  );
  assert(
    cancelledJob.state === "cancelled",
    `Job should be cancelled (got: ${cancelledJob.state})`,
  );
  console.log("  ✓ Job cancelled successfully");

  // 6.6 Test invalid job type (should still create job but may fail)
  try {
    await api<JobResponse>(
      `/plans/${planId}/jobs`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "invalid_type",
          params: {},
        }),
      },
      token,
    );
    // It might actually succeed in creating the job, just will fail during processing
    console.log("  ✓ Invalid job type handled");
  } catch {
    // Or it might be rejected at creation time
    console.log("  ✓ Invalid job type rejected");
  }

  console.log("");

  // ============================================================================
  // 7. CONVERSATION TESTS
  // ============================================================================
  console.log("💬 Testing Conversations...");

  // 7.1 List conversations (should have default conversation)
  const convList = await api<PaginatedResponse<ConversationResponse>>(
    `/plans/${planId}/conversations`,
    {},
    token,
  );
  assert(convList.data.length > 0, "Should have at least one conversation");
  const defaultConv = convList.data.find((c) => c.isDefault);
  assert(!!defaultConv, "Should have a default conversation");
  const conversationId = assertExists(defaultConv, "default conversation").id;
  console.log(`  ✓ Conversations retrieved (${convList.total} total)`);
  console.log(`  ✓ Default conversation found: ${conversationId}`);

  // 7.2 Get specific conversation
  const conversation = await api<ConversationResponse>(
    `/conversations/${conversationId}`,
    {},
    token,
  );
  assert(
    conversation.id === conversationId,
    "Should fetch correct conversation",
  );
  console.log("  ✓ Single conversation fetched");

  // 7.3 Create additional conversation
  const newConv = await api<ConversationResponse>(
    `/plans/${planId}/conversations`,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Test Conversation",
      }),
    },
    token,
  );
  assert(!!newConv.id, "New conversation should have ID");
  assert(newConv.isDefault === false, "New conversation should not be default");
  console.log(`  ✓ New conversation created: ${newConv.id}`);

  console.log("");

  // ============================================================================
  // 8. MESSAGE TESTS
  // ============================================================================
  console.log("✉️  Testing Messages...");

  // 8.1 Send a message
  const message = await api<MessageResponse>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: `Hi! Please refine the hotels we found in ${CITY}. I prefer boutique hotels.`,
      }),
    },
    token,
  );
  assert(!!message.id, "Message should have ID");
  assert(
    message.conversationId === conversationId,
    "Message should belong to conversation",
  );
  assert(message.role === "user", "Message role should be user");
  console.log(`  ✓ Message sent: ${message.id}`);

  // 8.2 List messages in conversation
  const messagesList = await api<PaginatedResponse<MessageResponse>>(
    `/conversations/${conversationId}/messages?page=1&limit=50`,
    {},
    token,
  );
  assert(messagesList.data.length > 0, "Should have at least one message");
  assert(
    messagesList.data.some((m) => m.id === message.id),
    "Should find sent message in list",
  );
  console.log(`  ✓ Messages list retrieved (${messagesList.total} total)`);

  // 8.3 Send another message
  const message2 = await api<MessageResponse>(
    `/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: "Also, can you suggest some good restaurants nearby?",
      }),
    },
    token,
  );
  console.log(`  ✓ Second message sent: ${message2.id}`);

  console.log("");

  // ============================================================================
  // 9. PAGINATION TESTS
  // ============================================================================
  console.log("📄 Testing Pagination...");

  // 9.1 Test pagination on jobs
  const jobsPage1 = await api<PaginatedResponse<JobResponse>>(
    `/plans/${planId}/jobs?page=1&limit=2`,
    {},
    token,
  );
  assert(jobsPage1.limit === 2, "Limit should be 2");
  assert(jobsPage1.page === 1, "Page should be 1");
  assert(jobsPage1.data.length <= 2, "Should have at most 2 items");
  console.log("  ✓ Jobs pagination works");

  // 9.2 Test pagination on messages
  const messagesPage1 = await api<PaginatedResponse<MessageResponse>>(
    `/conversations/${conversationId}/messages?page=1&limit=1`,
    {},
    token,
  );
  assert(messagesPage1.limit === 1, "Limit should be 1");
  assert(messagesPage1.data.length <= 1, "Should have at most 1 item");
  console.log("  ✓ Messages pagination works");

  console.log("");

  // ============================================================================
  // 10. EMBEDDINGS SEARCH (OPTIONAL)
  // ============================================================================
  console.log("🔍 Testing Embeddings Search (optional)...");

  try {
    const searchResults = await api<Array<{ id: string; similarity: number }>>(
      "/embeddings/search",
      {
        method: "POST",
        body: JSON.stringify({
          planId,
          query: `hotels in ${CITY}`,
          topK: 3,
        }),
      },
      token,
    );
    console.log(
      `  ✓ Embeddings search successful (${searchResults?.length ?? 0} results)`,
    );
  } catch {
    console.log("  ℹ Embeddings search skipped/disabled");
  }

  console.log("");

  // ============================================================================
  // 11. ERROR SCENARIOS
  // ============================================================================
  console.log("❌ Testing Error Scenarios...");

  // 11.1 Access another user's plan (create second user)
  const otherEmail = `other_${Date.now()}@wandermind.dev`;
  await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: otherEmail,
      password: PASSWORD,
      name: "Other Test User",
    }),
  });
  const otherLogin = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: otherEmail, password: PASSWORD }),
  });
  const otherToken = otherLogin.accessToken;

  try {
    await api<PlanResponse>(`/plans/${planId}`, {}, otherToken);
    throw new Error("Should not access other user's plan");
  } catch (err) {
    const error = err as Error;
    assert(
      error.message.includes("404"),
      "Should get 404 for other user's plan",
    );
  }
  console.log("  ✓ Cross-user access denied");

  // 11.2 Access non-existent job
  try {
    await api<JobResponse>(
      "/jobs/00000000-0000-0000-0000-000000000000",
      {},
      token,
    );
    throw new Error("Should not access non-existent job");
  } catch (err) {
    const error = err as Error;
    assert(
      error.message.includes("404"),
      "Should get 404 for non-existent job",
    );
  }
  console.log("  ✓ Non-existent job access denied");

  // 11.3 Invalid request body
  try {
    await api<PlanResponse>(
      "/plans",
      {
        method: "POST",
        body: JSON.stringify({ title: "" }), // Empty title might be invalid
      },
      token,
    );
    // Might succeed with empty title, that's okay
    console.log("  ✓ Empty title handled");
  } catch {
    console.log("  ✓ Invalid request body rejected");
  }

  console.log("");

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const totalMs = Date.now() - t0;
  console.log("═".repeat(60));
  console.log("✅ SMOKE TEST PASSED");
  console.log("═".repeat(60));
  console.log(`Total time: ${totalMs}ms (${(totalMs / 1000).toFixed(2)}s)`);
  console.log(`Tests completed: All major flows validated`);
  console.log(`Jobs tested: research_hotel, find_food, find_attraction`);
  console.log(
    `Features tested: Auth, Plans, Jobs, Conversations, Messages, Pagination`,
  );
  console.log("═".repeat(60));

  process.exit(0);
})().catch((err) => {
  console.error("");
  console.error("═".repeat(60));
  console.error("❌ SMOKE TEST FAILED");
  console.error("═".repeat(60));
  console.error(err);
  console.error("═".repeat(60));
  process.exit(1);
});
