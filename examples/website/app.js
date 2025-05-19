import { RateLimiter, Algorithm } from "./rate-limiter.js";

// DOM elements
const algorithmSelect = document.getElementById("algorithm");
const maxRequestsInput = document.getElementById("maxRequests");
const windowSizeInput = document.getElementById("windowSize");
const refillRateInput = document.getElementById("refillRate");
const refillIntervalInput = document.getElementById("refillInterval");
const precisionInput = document.getElementById("precision");
const refillRateRow = document.getElementById("refillRateRow");
const refillIntervalRow = document.getElementById("refillIntervalRow");
const precisionRow = document.getElementById("precisionRow");
const singleRequestBtn = document.getElementById("singleRequest");
const burstRequestsBtn = document.getElementById("burstRequests");
const autoRequestsBtn = document.getElementById("autoRequests");
const resetAllBtn = document.getElementById("resetAll");
const fixedWindowStatus = document.getElementById("fixedWindowStatus");
const slidingWindowStatus = document.getElementById("slidingWindowStatus");
const tokenBucketStatus = document.getElementById("tokenBucketStatus");
const requestLog = document.getElementById("requestLog");

// Rate limiter instances
let fixedWindowLimiter = new RateLimiter({
	algorithm: Algorithm.FIXED_WINDOW,
	max: parseInt(maxRequestsInput.value),
	window: parseInt(windowSizeInput.value),
});

let slidingWindowLimiter = new RateLimiter({
	algorithm: Algorithm.SLIDING_WINDOW,
	max: parseInt(maxRequestsInput.value),
	window: parseInt(windowSizeInput.value),
	precision: parseInt(precisionInput.value),
});

let tokenBucketLimiter = new RateLimiter({
	algorithm: Algorithm.TOKEN_BUCKET,
	max: parseInt(maxRequestsInput.value),
	window: parseInt(windowSizeInput.value),
	refillRate: parseInt(refillRateInput.value),
	refillInterval: parseInt(refillIntervalInput.value),
});

let autoRequestInterval = null;

// Update UI based on selected algorithm
function updateAlgorithmUI() {
	const algorithm = algorithmSelect.value;

	// Show/hide relevant config fields
	refillRateRow.style.display = algorithm === "TOKEN_BUCKET" ? "flex" : "none";
	refillIntervalRow.style.display = algorithm === "TOKEN_BUCKET" ? "flex" : "none";
	precisionRow.style.display = algorithm === "SLIDING_WINDOW" ? "flex" : "none";
}

// Create a rate limiter based on current config
function createRateLimiter(algorithm) {
	const config = {
		algorithm,
		max: parseInt(maxRequestsInput.value),
		window: parseInt(windowSizeInput.value),
	};

	if (algorithm === Algorithm.SLIDING_WINDOW) {
		config.precision = parseInt(precisionInput.value);
	}

	if (algorithm === Algorithm.TOKEN_BUCKET) {
		config.refillRate = parseInt(refillRateInput.value);
		config.refillInterval = parseInt(refillIntervalInput.value);
	}

	return new RateLimiter(config);
}

// Make a request to all limiters
function makeRequest() {
	const endpoint = "/api/test";
	const identifier = "test-user";
	const timestamp = new Date().toLocaleTimeString();

	// Test all three algorithms
	const fixedResult = fixedWindowLimiter.check(endpoint, identifier);
	const slidingResult = slidingWindowLimiter.check(endpoint, identifier);
	const tokenResult = tokenBucketLimiter.check(endpoint, identifier);

	// Update UI
	updateStatus(fixedWindowStatus, fixedResult, timestamp);
	updateStatus(slidingWindowStatus, slidingResult, timestamp);
	updateStatus(tokenBucketStatus, tokenResult, timestamp);

	// Log the request
	logRequest(fixedResult, slidingResult, tokenResult, timestamp);
}

// Update status display
function updateStatus(element, result, timestamp) {
	element.innerHTML = `
    <div>Time: ${timestamp}</div>
    <div>Status: <span class="${result.limited ? "limited" : "allowed"}">${result.limited ? "LIMITED" : "ALLOWED"}</span></div>
    <div>Remaining: ${result.remaining}/${result.limit}</div>
    <div>Current: ${result.current}</div>
    <div>Reset in: ${Math.ceil((result.reset - Date.now()) / 1000)}s</div>
  `;

	element.className = `status ${result.limited ? "limited" : "allowed"}`;
}

// Log the request
function logRequest(fixedResult, slidingResult, tokenResult, timestamp) {
	const logEntry = document.createElement("div");
	logEntry.className = "log-entry";
	logEntry.innerHTML = `
  	<strong>${timestamp}</strong> -
  	Fixed: ${fixedResult.limited ? "LIMITED" : "ALLOWED"} (${fixedResult.remaining}/${fixedResult.limit}),
  	Sliding: ${slidingResult.limited ? "LIMITED" : "ALLOWED"} (${slidingResult.remaining}/${slidingResult.limit}),
  	Token: ${tokenResult.limited ? "LIMITED" : "ALLOWED"} (${tokenResult.remaining}/${tokenResult.limit})
  `;
	requestLog.prepend(logEntry);
}

// Make burst requests
function makeBurstRequests() {
	const burstSize = parseInt(maxRequestsInput.value) * 2;
	for (let i = 0; i < burstSize; i++) {
		setTimeout(() => makeRequest(), i * 50);
	}
}

// Toggle auto requests
function toggleAutoRequests() {
	if (autoRequestInterval) {
		clearInterval(autoRequestInterval);
		autoRequestInterval = null;
		autoRequestsBtn.textContent = "Auto Requests (1/sec)";
	} else {
		autoRequestInterval = setInterval(makeRequest, 1000);
		autoRequestsBtn.textContent = "Stop Auto Requests";
	}
}

// Reset all limiters
function resetAll() {
	fixedWindowLimiter.clear();
	slidingWindowLimiter.clear();
	tokenBucketLimiter.clear();

	// Recreate limiters with current config
	fixedWindowLimiter = createRateLimiter(Algorithm.FIXED_WINDOW);
	slidingWindowLimiter = createRateLimiter(Algorithm.SLIDING_WINDOW);
	tokenBucketLimiter = createRateLimiter(Algorithm.TOKEN_BUCKET);

	// Clear logs
	requestLog.innerHTML = "<h3>Request Log</h3>";

	// Update status displays
	const timestamp = new Date().toLocaleTimeString();
	updateStatus(
		fixedWindowStatus,
		{
			limited: false,
			remaining: parseInt(maxRequestsInput.value),
			limit: parseInt(maxRequestsInput.value),
			current: 0,
			reset: Date.now() + parseInt(windowSizeInput.value),
		},
		timestamp
	);

	updateStatus(
		slidingWindowStatus,
		{
			limited: false,
			remaining: parseInt(maxRequestsInput.value),
			limit: parseInt(maxRequestsInput.value),
			current: 0,
			reset: Date.now() + parseInt(windowSizeInput.value),
		},
		timestamp
	);

	updateStatus(
		tokenBucketStatus,
		{
			limited: false,
			remaining: parseInt(maxRequestsInput.value),
			limit: parseInt(maxRequestsInput.value),
			current: 0,
			reset: Date.now() + parseInt(windowSizeInput.value),
		},
		timestamp
	);
}

// Event listeners
algorithmSelect.addEventListener("change", updateAlgorithmUI);
singleRequestBtn.addEventListener("click", makeRequest);
burstRequestsBtn.addEventListener("click", makeBurstRequests);
autoRequestsBtn.addEventListener("click", toggleAutoRequests);
resetAllBtn.addEventListener("click", resetAll);

// Config change listeners
maxRequestsInput.addEventListener("change", resetAll);
windowSizeInput.addEventListener("change", resetAll);
refillRateInput.addEventListener("change", resetAll);
refillIntervalInput.addEventListener("change", resetAll);
precisionInput.addEventListener("change", resetAll);

// Initialize UI
updateAlgorithmUI();
resetAll();
