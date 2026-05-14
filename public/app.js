import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const stateRef = doc(db, "rooms", "default");
const responsesRef = collection(db, "rooms", "default", "responses");

const $ = (selector) => document.querySelector(selector);

const elements = {
  studentView: $("#studentView"),
  adminView: $("#adminView"),
  studentQuestion: $("#studentQuestion"),
  studentHint: $("#studentHint"),
  answerForm: $("#answerForm"),
  nicknameField: $("#nicknameField"),
  nicknameInput: $("#nicknameInput"),
  choiceBox: $("#choiceBox"),
  textField: $("#textField"),
  answerInput: $("#answerInput"),
  submittedCard: $("#submittedCard"),
  responseCount: $("#responseCount"),
  resultBoard: $("#resultBoard"),
  loginForm: $("#loginForm"),
  adminIdInput: $("#adminIdInput"),
  adminPasswordInput: $("#adminPasswordInput"),
  logoutButton: $("#logoutButton"),
  adminStatus: $("#adminStatus"),
  questionForm: $("#questionForm"),
  questionInput: $("#questionInput"),
  typeInput: $("#typeInput"),
  optionsField: $("#optionsField"),
  optionsInput: $("#optionsInput"),
  adminResponseCount: $("#adminResponseCount"),
  adminResults: $("#adminResults"),
};

let currentQuestion = null;
let responses = [];

function route() {
  const admin = location.hash === "#/admin";
  elements.studentView.classList.toggle("hidden", admin);
  elements.adminView.classList.toggle("hidden", !admin);
}

function normalize(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function getSubmittedKey() {
  return currentQuestion?.version ? `free-mentimeter-submitted-${currentQuestion.version}` : "";
}

function hasSubmitted() {
  const key = getSubmittedKey();
  return key && localStorage.getItem(key) === "1";
}

function markSubmitted() {
  const key = getSubmittedKey();
  if (key) localStorage.setItem(key, "1");
}

function renderStudentQuestion() {
  const question = currentQuestion;
  const hasQuestion = Boolean(question?.text);

  elements.studentQuestion.textContent = hasQuestion ? question.text : "아직 열린 질문이 없습니다";
  elements.studentHint.textContent = hasQuestion
    ? question.type === "race"
      ? "닉네임과 답변을 빠르게 제출하세요."
      : "한 번 제출하면 질문이 바뀔 때까지 다시 제출할 수 없습니다."
    : "관리자가 질문을 열면 바로 참여할 수 있어요.";

  elements.answerForm.classList.toggle("hidden", !hasQuestion || hasSubmitted());
  elements.submittedCard.classList.toggle("hidden", !hasQuestion || !hasSubmitted());
  elements.nicknameField.classList.toggle("hidden", question?.type !== "race");
  elements.choiceBox.classList.toggle("hidden", question?.type !== "multiple");
  elements.textField.classList.toggle("hidden", question?.type === "multiple" || !hasQuestion);

  elements.choiceBox.innerHTML = "";
  if (question?.type === "multiple") {
    for (const option of question.options || []) {
      const id = crypto.randomUUID();
      const label = document.createElement("label");
      label.className = "choice-option";
      label.innerHTML = `<input type="radio" name="choice" value="${escapeHtml(option)}" required><span>${escapeHtml(option)}</span>`;
      label.querySelector("input").id = id;
      elements.choiceBox.append(label);
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderResults(target) {
  target.innerHTML = "";
  const total = responses.length;

  if (!currentQuestion?.text) {
    target.innerHTML = `<p class="hint">질문이 열리면 결과가 표시됩니다.</p>`;
    return;
  }

  if (total === 0) {
    target.innerHTML = `<p class="hint">아직 응답이 없습니다.</p>`;
    return;
  }

  if (currentQuestion.type === "multiple") {
    renderMultiple(target, total);
  } else if (currentQuestion.type === "race") {
    renderRace(target);
  } else {
    renderWordCloud(target);
  }
}

function renderMultiple(target, total) {
  const counts = new Map((currentQuestion.options || []).map((option) => [option, 0]));
  for (const item of responses) counts.set(item.answer, (counts.get(item.answer) || 0) + 1);

  for (const [option, count] of counts) {
    const percent = total ? Math.round((count / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label"><span>${escapeHtml(option)}</span><span>${count}명</span></div>
      <div class="bar-track"><div class="bar-fill" style="--value:${percent}%"></div></div>
    `;
    target.append(row);
  }
}

function renderWordCloud(target) {
  const counts = new Map();
  for (const item of responses) {
    const key = normalize(item.answer || "");
    if (!key) continue;
    counts.set(key, {
      label: item.answer.trim(),
      count: (counts.get(key)?.count || 0) + 1,
    });
  }

  const max = Math.max(...Array.from(counts.values()).map((item) => item.count), 1);
  const cloud = document.createElement("div");
  cloud.className = "word-cloud";
  for (const item of Array.from(counts.values()).sort((a, b) => b.count - a.count)) {
    const word = document.createElement("span");
    word.className = "word";
    word.style.setProperty("--size", `${1 + (item.count / max) * 2.9}rem`);
    word.textContent = item.count > 1 ? `${item.label} ${item.count}` : item.label;
    cloud.append(word);
  }
  target.append(cloud);
}

function renderRace(target) {
  const startedAt = currentQuestion.startedAt?.toMillis?.() || Date.now();
  const list = document.createElement("div");
  list.className = "race-list";
  responses
    .filter((item) => item.createdAt?.toMillis)
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
    .slice(0, 20)
    .forEach((item, index) => {
      const seconds = Math.max(0, (item.createdAt.toMillis() - startedAt) / 1000);
      const row = document.createElement("div");
      row.className = "race-row";
      row.innerHTML = `
        <span class="race-rank">${index + 1}</span>
        <span><strong class="race-name">${escapeHtml(item.nickname || "익명")}</strong><br>${escapeHtml(item.answer || "")}</span>
        <span class="race-time">${seconds.toFixed(2)}초</span>
      `;
      list.append(row);
    });
  target.append(list);
}

function syncCounts() {
  elements.responseCount.textContent = responses.length;
  elements.adminResponseCount.textContent = responses.length;
}

async function clearResponses() {
  const snapshot = await getDocs(query(responsesRef, limit(300)));
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  if (snapshot.size === 300) await clearResponses();
}

elements.answerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentQuestion?.text || hasSubmitted()) return;

  const formData = new FormData(elements.answerForm);
  const selectedChoice = formData.get("choice");
  const answer =
    currentQuestion.type === "multiple" ? selectedChoice : elements.answerInput.value.trim();
  const nickname = elements.nicknameInput.value.trim();

  if (!answer) return;
  if (currentQuestion.type === "race" && !nickname) {
    elements.nicknameInput.focus();
    return;
  }

  await runTransaction(db, async (transaction) => {
    const state = await transaction.get(stateRef);
    const latest = state.data();
    if (!latest || latest.version !== currentQuestion.version) {
      throw new Error("QUESTION_CHANGED");
    }
    transaction.set(doc(responsesRef), {
      answer,
      normalizedAnswer: normalize(answer),
      nickname: currentQuestion.type === "race" ? nickname : "",
      questionVersion: currentQuestion.version,
      createdAt: serverTimestamp(),
    });
  });

  elements.answerForm.reset();
  markSubmitted();
  renderStudentQuestion();
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth,
      elements.adminIdInput.value.trim(),
      elements.adminPasswordInput.value,
    );
    elements.loginForm.reset();
  } catch (error) {
    elements.adminStatus.textContent = "아이디 또는 비밀번호가 맞지 않습니다.";
    elements.adminPasswordInput.focus();
  }
});

elements.logoutButton.addEventListener("click", () => signOut(auth));

elements.typeInput.addEventListener("change", () => {
  elements.optionsField.classList.toggle("hidden", elements.typeInput.value !== "multiple");
});

elements.questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = elements.questionInput.value.trim();
  const type = elements.typeInput.value;
  const options = elements.optionsInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!text) return;
  if (type === "multiple" && options.length < 2) {
    elements.optionsInput.focus();
    return;
  }

  await clearResponses();
  await setDoc(stateRef, {
    text,
    type,
    options: type === "multiple" ? options : [],
    version: crypto.randomUUID(),
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
});

onAuthStateChanged(auth, (user) => {
  elements.loginForm.classList.toggle("hidden", Boolean(user));
  elements.logoutButton.classList.toggle("hidden", !user);
  elements.questionForm.classList.toggle("hidden", !user);
  elements.adminStatus.textContent = user
    ? "아이디와 비밀번호가 맞습니다. 관리자 모드가 열렸습니다."
    : "질문 관리는 관리자 계정으로 로그인해야 합니다.";
});

onSnapshot(stateRef, (snapshot) => {
  currentQuestion = snapshot.exists() ? snapshot.data() : null;
  if (currentQuestion) {
    elements.questionInput.value = currentQuestion.text || "";
    elements.typeInput.value = currentQuestion.type || "multiple";
    elements.optionsInput.value = (currentQuestion.options || []).join("\n");
    elements.optionsField.classList.toggle("hidden", elements.typeInput.value !== "multiple");
  }
  renderStudentQuestion();
  renderResults(elements.resultBoard);
  renderResults(elements.adminResults);
});

onSnapshot(query(responsesRef, orderBy("createdAt", "asc")), (snapshot) => {
  responses = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  syncCounts();
  renderResults(elements.resultBoard);
  renderResults(elements.adminResults);
});

window.addEventListener("hashchange", route);
route();
