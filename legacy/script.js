// MET values (Metabolic Equivalent of Task) per exercise, machine and intensity.
// Values are approximations based on the Compendium of Physical Activities.
const EXERCISES = {
  "Running": {
    "Treadmill":          { light: 7.0, moderate: 9.8, vigorous: 11.8 },
    "Outdoor (no machine)": { light: 7.0, moderate: 9.8, vigorous: 11.8 },
  },
  "Walking": {
    "Treadmill":          { light: 3.0, moderate: 3.8, vigorous: 5.0 },
    "Treadmill (incline)": { light: 5.0, moderate: 6.0, vigorous: 8.0 },
  },
  "Cycling": {
    "Stationary Bike":    { light: 3.5, moderate: 6.8, vigorous: 8.8 },
    "Spin Bike":          { light: 5.0, moderate: 8.5, vigorous: 11.0 },
    "Recumbent Bike":     { light: 3.0, moderate: 5.5, vigorous: 7.0 },
  },
  "Elliptical": {
    "Elliptical Trainer": { light: 4.0, moderate: 5.0, vigorous: 6.5 },
  },
  "Rowing": {
    "Rowing Machine":     { light: 4.8, moderate: 7.0, vigorous: 8.5 },
  },
  "Stair Climbing": {
    "Stair Climber":      { light: 5.0, moderate: 8.8, vigorous: 10.0 },
  },
  "Jump Rope": {
    "Jump Rope":          { light: 8.8, moderate: 11.8, vigorous: 12.3 },
  },
  "Chest Press": {
    "Chest Press Machine": { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Barbell (Bench)":    { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Dumbbells":          { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Smith Machine":      { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  },
  "Squats": {
    "Barbell":            { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Smith Machine":      { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Bodyweight":         { light: 3.5, moderate: 5.0, vigorous: 8.0 },
  },
  "Leg Press": {
    "Leg Press Machine":  { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  },
  "Deadlift": {
    "Barbell":            { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Dumbbells":          { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  },
  "Lat Pulldown": {
    "Cable Machine":      { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  },
  "Shoulder Press": {
    "Shoulder Press Machine": { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Dumbbells":          { light: 3.5, moderate: 5.0, vigorous: 6.0 },
    "Barbell":            { light: 3.5, moderate: 5.0, vigorous: 6.0 },
  },
  "Bicep Curls": {
    "Dumbbells":          { light: 3.0, moderate: 3.5, vigorous: 5.0 },
    "Cable Machine":      { light: 3.0, moderate: 3.5, vigorous: 5.0 },
    "Barbell":            { light: 3.0, moderate: 3.5, vigorous: 5.0 },
  },
  "Push-ups": {
    "Bodyweight":         { light: 3.8, moderate: 5.0, vigorous: 8.0 },
  },
  "Burpees": {
    "Bodyweight":         { light: 6.0, moderate: 8.0, vigorous: 10.0 },
  },
  "Plank": {
    "Bodyweight":         { light: 2.8, moderate: 3.8, vigorous: 4.5 },
  },
};

const LB_TO_KG = 0.453592;
const STORAGE_KEY = "exercise-tracker";

// Elements
const weightInput = document.getElementById("weight");
const unitSelect = document.getElementById("weight-unit");
const exerciseSelect = document.getElementById("exercise");
const machineSelect = document.getElementById("machine");
const intensitySelect = document.getElementById("intensity");
const durationInput = document.getElementById("duration");
const form = document.getElementById("exercise-form");
const preview = document.getElementById("preview");
const errorMsg = document.getElementById("error");
const logBody = document.getElementById("log-body");
const logTable = document.getElementById("log-table");
const emptyMsg = document.getElementById("empty-msg");
const totalEl = document.getElementById("total-calories");
const clearBtn = document.getElementById("clear-btn");

let log = [];

// ---------- Calculation ----------

function getWeightKg() {
  const value = parseFloat(weightInput.value);
  if (!value || value <= 0) return null;
  return unitSelect.value === "lb" ? value * LB_TO_KG : value;
}

function calculateCalories(met, weightKg, minutes) {
  return (met * 3.5 * weightKg / 200) * minutes;
}

// ---------- Dropdowns ----------

function populateExercises() {
  exerciseSelect.innerHTML = Object.keys(EXERCISES)
    .map(name => `<option value="${name}">${name}</option>`)
    .join("");
  populateMachines();
}

function populateMachines() {
  const machines = Object.keys(EXERCISES[exerciseSelect.value]);
  machineSelect.innerHTML = machines
    .map(name => `<option value="${name}">${name}</option>`)
    .join("");
}

// ---------- Preview ----------

function updatePreview() {
  const weightKg = getWeightKg();
  const minutes = parseFloat(durationInput.value);
  if (!weightKg || !minutes || minutes <= 0) {
    preview.textContent = "";
    return;
  }
  const met = EXERCISES[exerciseSelect.value][machineSelect.value][intensitySelect.value];
  const kcal = calculateCalories(met, weightKg, minutes);
  preview.textContent = `≈ ${Math.round(kcal)} kcal for this exercise`;
}

// ---------- Log ----------

function renderLog() {
  logBody.innerHTML = "";

  log.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.exercise}</td>
      <td>${entry.machine}</td>
      <td>${entry.intensity}</td>
      <td>${entry.minutes}</td>
      <td>${Math.round(entry.calories)}</td>
      <td><button class="remove" data-index="${index}" title="Remove">✕</button></td>
    `;
    logBody.appendChild(row);
  });

  const hasEntries = log.length > 0;
  logTable.style.display = hasEntries ? "" : "none";
  emptyMsg.style.display = hasEntries ? "none" : "";

  const total = log.reduce((sum, e) => sum + e.calories, 0);
  totalEl.textContent = Math.round(total);
}

// ---------- Storage ----------

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      weight: weightInput.value,
      unit: unitSelect.value,
      log,
    }));
  } catch (e) {
    // Storage unavailable; the app still works for this session.
  }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data) return;
    weightInput.value = data.weight || "";
    unitSelect.value = data.unit || "kg";
    log = Array.isArray(data.log) ? data.log : [];
  } catch (e) {
    log = [];
  }
}

// ---------- Events ----------

exerciseSelect.addEventListener("change", () => {
  populateMachines();
  updatePreview();
});

[machineSelect, intensitySelect, durationInput].forEach(el =>
  el.addEventListener("input", updatePreview)
);

[weightInput, unitSelect].forEach(el =>
  el.addEventListener("input", () => {
    updatePreview();
    save();
  })
);

form.addEventListener("submit", event => {
  event.preventDefault();
  errorMsg.textContent = "";

  const weightKg = getWeightKg();
  if (!weightKg) {
    errorMsg.textContent = "Please enter your weight first.";
    weightInput.focus();
    return;
  }

  const minutes = parseFloat(durationInput.value);
  if (!minutes || minutes <= 0) {
    errorMsg.textContent = "Please enter a valid duration.";
    return;
  }

  const exercise = exerciseSelect.value;
  const machine = machineSelect.value;
  const intensity = intensitySelect.value;
  const met = EXERCISES[exercise][machine][intensity];

  log.push({
    exercise,
    machine,
    intensity: intensity[0].toUpperCase() + intensity.slice(1),
    minutes,
    calories: calculateCalories(met, weightKg, minutes),
  });

  durationInput.value = "";
  preview.textContent = "";
  renderLog();
  save();
});

logBody.addEventListener("click", event => {
  const btn = event.target.closest(".remove");
  if (!btn) return;
  log.splice(Number(btn.dataset.index), 1);
  renderLog();
  save();
});

clearBtn.addEventListener("click", () => {
  if (log.length === 0) return;
  if (!confirm("Clear all exercises from today's workout?")) return;
  log = [];
  renderLog();
  save();
});

// ---------- Init ----------

load();
populateExercises();
renderLog();
