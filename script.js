"use strict";

// StudySprint AI - browser-based study productivity app

const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "studysprint-data-v1";
const THEME_KEY = "studysprint-theme";

let tasks = [];
let activeFilter = "all";
let focusMinutes = 0;

let selectedMinutes = 25;
let remainingSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;
let timerEndTime = null;

// ---------- Storage ----------

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    tasks = Array.isArray(saved.tasks)
      ? saved.tasks.filter(task =>
          task &&
          typeof task.id === "string" &&
          typeof task.title === "string" &&
          typeof task.subject === "string" &&
          typeof task.completed === "boolean"
        )
      : [];

    focusMinutes = Number.isFinite(saved.focusMinutes)
      ? Math.max(0, saved.focusMinutes)
      : 0;
  } catch {
    tasks = [];
    focusMinutes = 0;
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks,
      focusMinutes
    }));
  } catch {
    console.warn("Progress could not be saved in this browser.");
  }
}

// ---------- Date and dashboard ----------

function updateDate() {
  $("#todayDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date());
}

function updateDashboard() {
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const percentage = total ? Math.round(completed / total * 100) : 0;

  $("#taskCount").textContent = total;
  $("#completedCount").textContent = completed;
  $("#focusTime").textContent = `${focusMinutes} min`;
  $("#progressPercent").textContent = `${percentage}%`;
  $("#taskPill").textContent = `${total} ${total === 1 ? "task" : "tasks"}`;

  $("#progressLabel").textContent = `${percentage}%`;
  $("#progressBar").style.width = `${percentage}%`;

  $("#progressMessage").textContent =
    total === 0 ? "Add a task to begin your progress." :
    percentage === 100 ? "Amazing! All your tasks are complete." :
    percentage >= 50 ? "Great work! Keep your momentum going." :
    "Every small step counts. Keep going!";
}

// ---------- Task management ----------

function renderTasks() {
  const list = $("#taskList");
  list.replaceChildren();

  const visibleTasks = tasks.filter(task => {
    if (activeFilter === "pending") return !task.completed;
    if (activeFilter === "completed") return task.completed;
    return true;
  });

  $("#emptyTasks").hidden = visibleTasks.length > 0;

  visibleTasks.forEach(task => {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Complete ${task.title}`);

    checkbox.addEventListener("change", () => {
      task.completed = checkbox.checked;
      saveData();
      renderTasks();
      updateDashboard();
    });

    const info = document.createElement("div");
    info.className = "task-info";

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.title;

    const subject = document.createElement("span");
    subject.className = "task-subject";
    subject.textContent = task.subject;

    info.append(name, subject);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${task.title}`);

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter(item => item.id !== task.id);
      saveData();
      renderTasks();
      updateDashboard();
    });

    item.append(checkbox, info, deleteButton);
    list.append(item);
  });
}

$("#taskForm").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("#taskInput");
  const title = input.value.trim();

  if (!title) return;

  tasks.unshift({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    title,
    subject: $("#subjectInput").value,
    completed: false
  });

  saveData();
  renderTasks();
  updateDashboard();

  input.value = "";
  input.focus();
});

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    document.querySelectorAll(".filter").forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });

    renderTasks();
  });
});

// ---------- Study plan generator ----------

// This is a rule-based demo, not a live AI model.
const goalDetails = {
  revision: {
    first: "Review your notes",
    firstDetail: "Read key concepts and highlight important points.",
    second: "Practice recall",
    secondDetail: "Close your notes and explain what you remember.",
    third: "Review difficult topics",
    thirdDetail: "Revisit concepts you found challenging.",
    fourth: "Quick recap",
    fourthDetail: "Summarize the most important ideas."
  },
  exam: {
    first: "Revise important topics",
    firstDetail: "Start with the topics most likely to appear in your exam.",
    second: "Solve practice questions",
    secondDetail: "Test your understanding without looking at notes.",
    third: "Review mistakes",
    thirdDetail: "Understand errors and revisit weak areas.",
    fourth: "Final recap",
    fourthDetail: "Review formulas, definitions and key facts."
  },
  assignment: {
    first: "Understand the requirements",
    firstDetail: "Break the assignment into smaller achievable tasks.",
    second: "Work on the main task",
    secondDetail: "Complete the most important section first.",
    third: "Finish remaining sections",
    thirdDetail: "Fill gaps and check your work.",
    fourth: "Review and polish",
    fourthDetail: "Check accuracy, formatting and completeness."
  },
  learning: {
    first: "Explore the new topic",
    firstDetail: "Read an introduction and identify key ideas.",
    second: "Learn core concepts",
    secondDetail: "Study the main concepts and work through examples.",
    third: "Practice what you learned",
    thirdDetail: "Try exercises or explain concepts in your own words.",
    fourth: "Summarize your learning",
    fourthDetail: "Write down what you learned and what to explore next."
  }
};

$("#plannerForm").addEventListener("submit", event => {
  event.preventDefault();

  const hours = Number($("#studyHours").value);
  const goal = $("#studyGoal").value;

  if (!Number.isFinite(hours) || hours < 1 || hours > 12) {
    $("#studyHours").focus();
    return;
  }

  const totalMinutes = hours * 60;
  const numberOfSessions = Math.max(1, Math.floor(totalMinutes / 30));
  const sessionMinutes = Math.floor(totalMinutes / numberOfSessions);
  const details = goalDetails[goal] || goalDetails.revision;

  const stages = [
    [details.first, details.firstDetail],
    [details.second, details.secondDetail],
    [details.third, details.thirdDetail],
    [details.fourth, details.fourthDetail]
  ];

  const output = $("#planOutput");
  output.replaceChildren();

  const result = document.createElement("div");
  result.className = "plan-result";

  const summary = document.createElement("div");
  summary.className = "plan-summary";
  summary.textContent =
    `${hours} hour${hours > 1 ? "s" : ""} planned · ` +
    `${numberOfSessions} study blocks · Take short breaks between blocks`;

  result.append(summary);

  stages.forEach((stage, index) => {
    const step = document.createElement("div");
    step.className = "plan-step";

    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = index + 1;

    const info = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = stage[0];

    const description = document.createElement("p");
    description.textContent =
      `${stage[1]} Suggested time: ${Math.max(10, Math.round(sessionMinutes / 4))} minutes.`;

    info.append(title, description);
    step.append(number, info);
    result.append(step);
  });

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Suggested schedule: adjust the time blocks to match your pace and take regular breaks.";

  result.append(note);
  output.append(result);
});

// ---------- Focus timer ----------

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 96;

function updateTimerDisplay() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  $("#timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const totalSeconds = selectedMinutes * 60;
  const fraction = totalSeconds
    ? remainingSeconds / totalSeconds
    : 0;

  $("#timerProgress").style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
  $("#timerProgress").style.strokeDashoffset =
    CIRCLE_CIRCUMFERENCE * (1 - fraction);

  document.title = timerRunning
    ? `${$("#timerDisplay").textContent} - StudySprint AI`
    : "StudySprint AI | Study Smarter";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
  timerEndTime = null;
  $("#startTimer").textContent = "▶ Start";
  updateTimerDisplay();
}

function selectTimer(minutes, button) {
  stopTimer();

  selectedMinutes = minutes;
  remainingSeconds = minutes * 60;

  document.querySelectorAll(".timer-tab").forEach(tab => {
    const active = tab === button;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });

  $("#timerLabel").textContent =
    minutes === 25 ? "READY TO FOCUS" :
    minutes === 5 ? "SHORT BREAK" : "LONG BREAK";

  updateTimerDisplay();
}

document.querySelectorAll(".timer-tab").forEach(button => {
  button.addEventListener("click", () => {
    selectTimer(Number(button.dataset.minutes), button);
  });
});

function finishTimer() {
  const wasFocusSession = selectedMinutes === 25;

  stopTimer();
  remainingSeconds = 0;
  updateTimerDisplay();

  if (wasFocusSession) {
    focusMinutes += selectedMinutes;
    saveData();
    updateDashboard();
  }

  $("#timerLabel").textContent = "SESSION COMPLETE";
  $("#startTimer").textContent = "▶ Start";

  alert(
    wasFocusSession
      ? "Great job! Focus session completed. Take a break."
      : "Break completed. Ready for your next session?"
  );
}

$("#startTimer").addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    return;
  }

  if (remainingSeconds <= 0) {
    remainingSeconds = selectedMinutes * 60;
  }

  timerRunning = true;
  timerEndTime = Date.now() + remainingSeconds * 1000;
  $("#startTimer").textContent = "Ⅱ Pause";

  timerInterval = setInterval(() => {
    remainingSeconds = Math.max(
      0,
      Math.ceil((timerEndTime - Date.now()) / 1000)
    );

    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      finishTimer();
    }
  }, 250);
});

$("#resetTimer").addEventListener("click", () => {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  $("#timerLabel").textContent =
    selectedMinutes === 25 ? "READY TO FOCUS" :
    selectedMinutes === 5 ? "SHORT BREAK" : "LONG BREAK";
  updateTimerDisplay();
});

// ---------- Dark mode ----------

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("#themeToggle").textContent = dark ? "☀️" : "🌙";
  $("#themeToggle").setAttribute(
    "aria-label",
    dark ? "Switch to light mode" : "Switch to dark mode"
  );
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem(THEME_KEY) || "light";
} catch {
  // Use light mode if storage is unavailable.
}

applyTheme(savedTheme === "dark");

$("#themeToggle").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  applyTheme(dark);

  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Theme remains active for this page session.
  }
});

// ---------- Initialize app ----------

loadData();
updateDate();
renderTasks();
updateDashboard();
updateTimerDisplay();