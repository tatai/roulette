const SPIN_DURATION = 2000;
const TICK_INTERVAL = 80;
const QUERY_PARAM = "names";

const availableList = document.getElementById("availableList");
const selectedList = document.getElementById("selectedList");
const availableEmpty = document.getElementById("availableEmpty");
const selectedEmpty = document.getElementById("selectedEmpty");
const availableCount = document.getElementById("availableCount");
const selectedCount = document.getElementById("selectedCount");
const stageName = document.getElementById("stageName");
const stageMessage = document.getElementById("stageMessage");
const spinButton = document.getElementById("spinButton");
const nameInput = document.getElementById("nameInput");
const addButton = document.getElementById("addButton");

const availableActions = [
  { action: "remove", label: "Remove" },
  { action: "promote", label: "Promote" }
];
const selectedActions = [{ action: "demote", label: "Demote" }];

let availablePeople = [];
let selectedPeople = [];
let isSpinning = false;
let nextPersonId = 0;

function createPerson(name) {
  nextPersonId += 1;
  return { id: String(nextPersonId), name };
}

function normalize(name) {
  return name.trim().toLocaleLowerCase();
}

function isDuplicate(name) {
  const target = normalize(name);
  return [...availablePeople, ...selectedPeople].some(
    (person) => normalize(person.name) === target
  );
}

function readNamesFromQuery() {
  const raw = new URLSearchParams(window.location.search).get(QUERY_PARAM);
  if (!raw) {
    return [];
  }
  const seen = new Set();
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(normalize(name))) {
        return false;
      }
      seen.add(normalize(name));
      return true;
    });
}

function findPerson(list, id) {
  return list.find((person) => person.id === id);
}

function movePerson(id, source, target) {
  const index = source.findIndex((person) => person.id === id);
  if (index === -1) {
    return null;
  }
  const [person] = source.splice(index, 1);
  target.push(person);
  return person;
}

function createActionButton({ action, label }, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `roster__action roster__action--${action}`;
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  button.disabled = isSpinning;
  return button;
}

function createRosterItem(person, actions) {
  const item = document.createElement("li");
  item.className = "roster__item";

  const name = document.createElement("span");
  name.className = "roster__name";
  name.textContent = person.name;

  const actionGroup = document.createElement("div");
  actionGroup.className = "roster__actions";
  actions.forEach((action) => {
    actionGroup.append(createActionButton(action, person.id));
  });

  item.append(name, actionGroup);
  return item;
}

function renderRoster(listElement, emptyElement, countElement, people, actions) {
  listElement.replaceChildren(
    ...people.map((person) => createRosterItem(person, actions))
  );
  emptyElement.hidden = people.length > 0;
  countElement.textContent = String(people.length);
}

function render() {
  renderRoster(
    availableList,
    availableEmpty,
    availableCount,
    availablePeople,
    availableActions
  );
  renderRoster(
    selectedList,
    selectedEmpty,
    selectedCount,
    selectedPeople,
    selectedActions
  );
  spinButton.disabled = isSpinning || availablePeople.length === 0;
  nameInput.disabled = isSpinning;
  addButton.disabled = isSpinning;
}

function updateMessage() {
  if (isSpinning) {
    stageMessage.textContent = "Spinning...";
  } else if (availablePeople.length === 0) {
    stageMessage.textContent = "No people left.";
  } else {
    stageMessage.textContent = `${availablePeople.length} still in the draw.`;
  }
}

function pickRandom(people) {
  return people[Math.floor(Math.random() * people.length)];
}

function showTickingName(person) {
  stageName.classList.remove("stage__name--revealed");
  stageName.classList.add("stage__name--ticking");
  stageName.textContent = person.name;
}

function revealWinner(person) {
  stageName.classList.remove("stage__name--ticking", "stage__name--revealed");
  void stageName.offsetWidth;
  stageName.classList.add("stage__name--revealed");
  stageName.textContent = person.name;
}

function spin() {
  if (isSpinning || availablePeople.length === 0) {
    return;
  }

  isSpinning = true;
  render();
  updateMessage();

  const ticker = window.setInterval(() => {
    showTickingName(pickRandom(availablePeople));
  }, TICK_INTERVAL);

  window.setTimeout(() => {
    window.clearInterval(ticker);
    const winner = pickRandom(availablePeople);
    movePerson(winner.id, availablePeople, selectedPeople);
    revealWinner(winner);
    isSpinning = false;
    render();
    updateMessage();
  }, SPIN_DURATION);
}

function addPerson(name) {
  const trimmed = name.trim();
  if (!trimmed || isDuplicate(trimmed)) {
    nameInput.classList.remove("composer__input--invalid");
    void nameInput.offsetWidth;
    nameInput.classList.add("composer__input--invalid");
    return;
  }
  nameInput.classList.remove("composer__input--invalid");
  availablePeople.push(createPerson(trimmed));
  nameInput.value = "";
  render();
  updateMessage();
}

function handleRosterClick(event) {
  const button = event.target.closest(".roster__action");
  if (!button || isSpinning) {
    return;
  }

  const { action, id } = button.dataset;
  if (action === "remove") {
    availablePeople = availablePeople.filter((person) => person.id !== id);
  } else if (action === "promote" && findPerson(availablePeople, id)) {
    movePerson(id, availablePeople, selectedPeople);
  } else if (action === "demote" && findPerson(selectedPeople, id)) {
    movePerson(id, selectedPeople, availablePeople);
  }

  render();
  updateMessage();
}

availableList.addEventListener("click", handleRosterClick);
selectedList.addEventListener("click", handleRosterClick);
spinButton.addEventListener("click", spin);
addButton.addEventListener("click", () => addPerson(nameInput.value));
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addPerson(nameInput.value);
  }
});

availablePeople = readNamesFromQuery().map(createPerson);
render();
updateMessage();
