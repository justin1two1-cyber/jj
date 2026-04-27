const body = document.body;
const bootLine = document.querySelector("#boot-line");
const assistantStatus = document.querySelector("#assistant-status");
const transcriptLog = document.querySelector("#transcript-log");
const commandForm = document.querySelector("#command-form");
const commandInput = document.querySelector("#command-input");
const modeLabel = document.querySelector("#mode-label");
const voiceState = document.querySelector("#voice-state");
const listeningIndicator = document.querySelector("#listening-indicator");
const panelTitle = document.querySelector("#panel-title");
const panelDescription = document.querySelector("#panel-description");
const metricOne = document.querySelector("#metric-one");
const metricTwo = document.querySelector("#metric-two");
const metricThree = document.querySelector("#metric-three");
const navStars = document.querySelectorAll(".nav-star");
const conversation = [];

const scenes = {
  overview: {
    title: "Vallelonga Tech Systems",
    description: "We design AI automation systems that feel precise, useful, and human-guided. Candy turns the website into a command interface so visitors can ask for exactly what they need instead of hunting through menus.",
    metrics: [
      "AI workflow automation",
      "Realtime human guidance",
      "\"Candy, show me automations\""
    ],
    reply: "This is the overview layer. Vallelonga Tech Systems builds AI automations, intelligent interfaces, and guided systems that feel more like command decks than conventional websites."
  },
  automation: {
    title: "Automation Systems",
    description: "Vallelonga automates repetitive operations across sales, support, fulfillment, scheduling, reporting, and internal coordination. The emphasis is not just speed, but clear handoffs, exception handling, and trust.",
    metrics: [
      "Lead routing and triage",
      "Ops workflows with escalation",
      "Human override always available"
    ],
    reply: "In the automation layer, we focus on workflows that remove repetitive load without removing human judgment. Think triage, routing, summarization, alerts, and multi-step process orchestration."
  },
  platforms: {
    title: "Platform Integrations",
    description: "We connect AI systems into the tools teams already use: CRMs, communication channels, knowledge bases, ticketing systems, dashboards, calendars, and custom internal software.",
    metrics: [
      "CRM and inbox integrations",
      "Knowledge and reporting pipelines",
      "API-first architecture"
    ],
    reply: "Platform integrations are where the automation becomes real. We wire intelligence into the stack you already rely on, then design the control layer around your team."
  },
  cases: {
    title: "Case Files",
    description: "This layer is for impact stories: faster response times, cleaner operations, better lead qualification, reduced admin work, and clearer visibility into what the AI system is doing at every step.",
    metrics: [
      "Faster response operations",
      "Lower manual admin load",
      "Clearer executive visibility"
    ],
    reply: "Case files are where the value becomes concrete. We can frame examples around support automation, client onboarding, sales qualification, or operational reporting depending on your audience."
  },
  lab: {
    title: "Prototype Lab",
    description: "The lab is where new interface experiments live: holographic demos, voice-first command decks, AI copilots, live dashboards, and experiential product storytelling for ambitious technology brands.",
    metrics: [
      "Immersive brand demos",
      "Voice-first AI interfaces",
      "Rapid concept prototyping"
    ],
    reply: "The lab view is the experimental zone. It shows how Vallelonga can package advanced automation into something memorable, cinematic, and easy to understand."
  },
  contact: {
    title: "Deployment Channel",
    description: "This is the handoff point for real conversations. Vallelonga can translate a rough idea, current bottleneck, or outdated workflow into a defined AI automation roadmap and an interface people can actually use.",
    metrics: [
      "Discovery and roadmap",
      "Build sprint planning",
      "hello@valltech.example"
    ],
    reply: "If you are ready to move, the next step is a discovery call around your bottlenecks, data sources, and what success should feel like once automation is live."
  }
};

const bootMessages = [
  "Powering holographic data sphere.",
  "Stabilizing electronic orbitals.",
  "Darkening workshop environment.",
  "Deploying galaxy navigation field.",
  "Bringing Candy to the center."
];

let recognition;
let speechEnabled = false;
let listening = false;

function addMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("span");
  label.className = "message-role";
  label.textContent = role === "assistant" ? "Candy" : "Visitor";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  wrapper.append(label, paragraph);
  transcriptLog.append(wrapper);
  transcriptLog.scrollTop = transcriptLog.scrollHeight;

  conversation.push({
    role,
    content: text
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.08;
  utterance.volume = 0.88;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function setView(view) {
  const scene = scenes[view] || scenes.overview;
  body.dataset.view = view;
  modeLabel.textContent = scene.title;
  panelTitle.textContent = scene.title;
  panelDescription.textContent = scene.description;
  metricOne.textContent = scene.metrics[0];
  metricTwo.textContent = scene.metrics[1];
  metricThree.textContent = scene.metrics[2];
  assistantStatus.textContent = scene.reply;

  navStars.forEach((node) => {
    node.classList.toggle("active", node.dataset.node === view);
  });
}

function interpretCommand(input) {
  const command = input.toLowerCase().trim();

  if (!command) {
    return {
      view: body.dataset.view || "overview",
      reply: "Tell me where you want to go. You can ask for automation systems, platform integrations, case files, the lab, or contact."
    };
  }

  if (command.includes("automation") || command.includes("workflow") || command.includes("agent")) {
    return { view: "automation", reply: scenes.automation.reply };
  }

  if (command.includes("platform") || command.includes("integration") || command.includes("crm") || command.includes("stack")) {
    return { view: "platforms", reply: scenes.platforms.reply };
  }

  if (command.includes("case") || command.includes("proof") || command.includes("results") || command.includes("impact")) {
    return { view: "cases", reply: scenes.cases.reply };
  }

  if (command.includes("lab") || command.includes("prototype") || command.includes("demo") || command.includes("experience")) {
    return { view: "lab", reply: scenes.lab.reply };
  }

  if (command.includes("contact") || command.includes("book") || command.includes("call") || command.includes("start") || command.includes("deploy")) {
    return { view: "contact", reply: scenes.contact.reply };
  }

  if (command.includes("who are you") || command.includes("overview") || command.includes("home") || command.includes("back")) {
    return { view: "overview", reply: scenes.overview.reply };
  }

  return {
    view: body.dataset.view || "overview",
    reply: "I can route you through automation systems, integrations, case files, the prototype lab, or the deployment channel. Tell me which layer you want."
  };
}

async function fetchCandyReply(onChunk) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: conversation })
  });

  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.detail || payload.error || "Candy is temporarily unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));
      if (data.delta) {
        fullText += data.delta;
        onChunk(fullText);
      }
      if (data.done) return fullText;
      if (data.error) throw new Error(data.error);
    }
  }

  return fullText;
}

async function processCommand(text) {
  addMessage("user", text);
  const result = interpretCommand(text);
  setView(result.view);
  updateListeningState("Thinking", "Signal routing");

  const wrapper = document.createElement("div");
  wrapper.className = "message assistant";
  const label = document.createElement("span");
  label.className = "message-role";
  label.textContent = "Candy";
  const paragraph = document.createElement("p");
  wrapper.append(label, paragraph);
  transcriptLog.append(wrapper);
  transcriptLog.scrollTop = transcriptLog.scrollHeight;

  try {
    const reply = await fetchCandyReply((partialText) => {
      paragraph.textContent = partialText;
      assistantStatus.textContent = partialText;
      transcriptLog.scrollTop = transcriptLog.scrollHeight;
    });

    conversation.push({ role: "assistant", content: reply });
    speak(reply);
    updateListeningState(listening ? "Listening" : "Stand by", listening ? "Mic live" : "Mic idle");
  } catch (error) {
    wrapper.remove();
    const fallbackReply = `${result.reply}${error instanceof Error ? ` — ${error.message}` : ""}`.trim();
    addMessage("assistant", fallbackReply);
    assistantStatus.textContent = fallbackReply;
    speak(result.reply);
    updateListeningState("Fallback", "Local guidance");
  }
}

function updateListeningState(stateText, indicatorText) {
  voiceState.textContent = stateText;
  listeningIndicator.textContent = indicatorText;
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition || speechEnabled) {
    if (!SpeechRecognition) {
      updateListeningState("Text mode", "Mic unavailable");
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    updateListeningState("Listening", "Mic live");
  };

  recognition.onend = () => {
    listening = false;
    updateListeningState("Stand by", "Mic idle");

    if (speechEnabled) {
      recognition.start();
    }
  };

  recognition.onerror = () => {
    updateListeningState("Voice limited", "Mic error");
  };

  recognition.onresult = (event) => {
    const latest = event.results[event.results.length - 1];
    const transcript = latest[0].transcript.trim();

    if (transcript) {
      commandInput.value = transcript;
      processCommand(transcript);
    }
  };

  speechEnabled = true;
  recognition.start();
}

function bootSequence() {
  bootMessages.forEach((message, index) => {
    window.setTimeout(() => {
      if (bootLine) {
        bootLine.textContent = message;
      }
    }, 1200 * index);
  });

  window.setTimeout(() => {
    body.classList.add("ready");
    const welcome = "Welcome to Vallelonga Tech Systems. I am Candy. Tell me what you want to explore and I will guide the interface for you.";
    assistantStatus.textContent = welcome;
    addMessage("assistant", welcome);
    speak(welcome);
  }, 6200);
}

commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = commandInput.value.trim();

  if (!value) {
    return;
  }

  processCommand(value);
  commandInput.value = "";
});

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commandForm.requestSubmit();
  }
});

document.addEventListener("pointerdown", initSpeechRecognition, { once: true });
document.addEventListener("keydown", initSpeechRecognition, { once: true });

setView("overview");
bootSequence();
