const SPIN_DURATION = 2000;
const TICK_INTERVAL = 80;
const QUERY_PARAM = "names";

const AVAILABLE_ACTIONS = [
  { action: "remove", label: "Remove" },
  { action: "promote", label: "Promote" }
];
const SELECTED_ACTIONS = [{ action: "demote", label: "Demote" }];

$(function () {
  const $availableList = $("#availableList");
  const $selectedList = $("#selectedList");
  const $availableEmpty = $("#availableEmpty");
  const $selectedEmpty = $("#selectedEmpty");
  const $availableCount = $("#availableCount");
  const $selectedCount = $("#selectedCount");
  const $stageName = $("#stageName");
  const $stageMessage = $("#stageMessage");
  const $spinButton = $("#spinButton");
  const $nameInput = $("#nameInput");
  const $addButton = $("#addButton");

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

  function findPerson(people, id) {
    return people.find((person) => person.id === id);
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

  function restartAnimation($element) {
    void $element[0].offsetWidth;
  }

  function createActionButton({ action, label }, id) {
    return $("<button>", {
      type: "button",
      class: `roster__action roster__action--${action}`,
      text: label,
      disabled: isSpinning,
      "data-action": action,
      "data-id": id
    });
  }

  function createRosterItem(person, actions) {
    const $actions = $("<div>", { class: "roster__actions" }).append(
      actions.map((action) => createActionButton(action, person.id))
    );

    return $("<li>", { class: "roster__item" }).append(
      $("<span>", { class: "roster__name", text: person.name }),
      $actions
    );
  }

  function renderRoster($list, $empty, $count, people, actions) {
    $list
      .empty()
      .append(people.map((person) => createRosterItem(person, actions)));
    $empty.prop("hidden", people.length > 0);
    $count.text(people.length);
  }

  function render() {
    renderRoster(
      $availableList,
      $availableEmpty,
      $availableCount,
      availablePeople,
      AVAILABLE_ACTIONS
    );
    renderRoster(
      $selectedList,
      $selectedEmpty,
      $selectedCount,
      selectedPeople,
      SELECTED_ACTIONS
    );
    $spinButton.prop("disabled", isSpinning || availablePeople.length === 0);
    $nameInput.prop("disabled", isSpinning);
    $addButton.prop("disabled", isSpinning);
  }

  function updateMessage() {
    if (isSpinning) {
      $stageMessage.text("Spinning...");
    } else if (availablePeople.length === 0) {
      $stageMessage.text("No people left.");
    } else {
      $stageMessage.text(`${availablePeople.length} still in the draw.`);
    }
  }

  function pickRandom(people) {
    return people[Math.floor(Math.random() * people.length)];
  }

  function showTickingName(person) {
    $stageName
      .removeClass("stage__name--revealed")
      .addClass("stage__name--ticking")
      .text(person.name);
  }

  function revealWinner(person) {
    $stageName.removeClass("stage__name--ticking stage__name--revealed");
    restartAnimation($stageName);
    $stageName.addClass("stage__name--revealed").text(person.name);
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

  function markInputAsInvalid() {
    $nameInput.removeClass("composer__input--invalid");
    restartAnimation($nameInput);
    $nameInput.addClass("composer__input--invalid");
  }

  function addPerson(name) {
    const trimmed = name.trim();
    if (!trimmed || isDuplicate(trimmed)) {
      markInputAsInvalid();
      return;
    }
    $nameInput.removeClass("composer__input--invalid").val("");
    availablePeople.push(createPerson(trimmed));
    render();
    updateMessage();
  }

  function handleRosterAction(event) {
    if (isSpinning) {
      return;
    }

    const $button = $(event.currentTarget);
    const action = $button.attr("data-action");
    const id = $button.attr("data-id");

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

  $availableList.on("click", ".roster__action", handleRosterAction);
  $selectedList.on("click", ".roster__action", handleRosterAction);
  $spinButton.on("click", spin);
  $addButton.on("click", () => addPerson($nameInput.val()));
  $nameInput.on("keydown", (event) => {
    if (event.key === "Enter") {
      addPerson($nameInput.val());
    }
  });

  availablePeople = readNamesFromQuery().map(createPerson);
  render();
  updateMessage();
});
