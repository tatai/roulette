const DURATIONS = { classic: 2000, focus: 10000, wheel: 6000 };
const TICK_INTERVAL = 80;
const QUERY_PARAM = "names";
const MODE_STORAGE_KEY = "roulette.mode";
const DEFAULT_MODE = "focus";
const WHEEL_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#3b82f6", "#ef4444", "#22c55e", "#a855f7"
];

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
  const $stage = $("#stage");
  const $board = $("#stageBoard");
  const $modeOptions = $(".modes__option");
  const canvas = $("#wheelCanvas")[0];
  const ctx = canvas.getContext("2d");

  let availablePeople = [];
  let selectedPeople = [];
  let isSpinning = false;
  let nextPersonId = 0;
  let wheelAngle = 0;
  let mode = loadMode();

  function loadMode() {
    try {
      const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
      return saved in DURATIONS ? saved : DEFAULT_MODE;
    } catch (error) {
      return DEFAULT_MODE;
    }
  }

  function saveMode() {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch (error) {
      // Storage unavailable; the mode just won't persist.
    }
  }

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

  function createActionButton({ action, label }, person) {
    const description = `${label} ${person.name}`;
    return $("<button>", {
      type: "button",
      class: `roster__action roster__action--${action}`,
      disabled: isSpinning,
      title: description,
      "aria-label": description,
      "data-action": action,
      "data-id": person.id,
      html: `<svg class="roster__icon" aria-hidden="true" focusable="false"><use href="#icon-${action}"></use></svg>`
    });
  }

  function createRosterItem(person, actions) {
    const $actions = $("<div>", { class: "roster__actions" }).append(
      actions.map((action) => createActionButton(action, person))
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

  function renderBoard() {
    $board.empty();
    if (availablePeople.length === 0) {
      $board.append($("<li>", { class: "board__empty", text: "No people left." }));
      return;
    }
    $board.append(
      availablePeople.map((person) =>
        $("<li>", { class: "chip", "data-id": person.id, text: person.name })
      )
    );
  }

  function drawWheel() {
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 6;
    ctx.clearRect(0, 0, size, size);

    const count = availablePeople.length;
    if (count === 0) {
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fill();
      return;
    }

    const arc = (Math.PI * 2) / count;
    const fontSize = Math.max(10, Math.min(24, Math.floor(radius * arc * 0.5)));
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    availablePeople.forEach((person, index) => {
      const start = wheelAngle + index * arc;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[index % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(11, 16, 32, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + arc / 2);
      ctx.fillStyle = "#fff";
      ctx.fillText(person.name, radius - 14, 0, radius - 40);
      ctx.restore();
    });
  }

  function renderStageView() {
    $stage.attr("data-mode", mode);
    $modeOptions.each(function () {
      const $option = $(this);
      $option.attr("aria-checked", $option.attr("data-mode") === mode);
    });
    $modeOptions.prop("disabled", isSpinning);
    if (mode === "focus") {
      renderBoard();
    } else if (mode === "wheel") {
      drawWheel();
    }
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
    renderStageView();
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

  function finishSpin(winner) {
    movePerson(winner.id, availablePeople, selectedPeople);
    revealWinner(winner);
    isSpinning = false;
    render();
    updateMessage();
  }

  function spinClassic(winner) {
    const ticker = window.setInterval(() => {
      showTickingName(pickRandom(availablePeople));
    }, TICK_INTERVAL);

    window.setTimeout(() => {
      window.clearInterval(ticker);
      finishSpin(winner);
    }, DURATIONS.classic);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function spinFocus(winner) {
    const FLASH_TIME = 600;
    const FINAL_HOLD = 400;
    const order = shuffle(availablePeople.filter((p) => p.id !== winner.id));
    const chipFor = (person) => $board.find(`.chip[data-id="${person.id}"]`);
    const weights = order.map((_, i) => {
      const progress = i / Math.max(order.length, 1);
      return 1 + 8 * progress * progress;
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const waitTime = DURATIONS.focus - FLASH_TIME - FINAL_HOLD;

    let elapsed = 0;
    order.forEach((person, i) => {
      elapsed += (weights[i] / totalWeight) * waitTime;
      window.setTimeout(() => chipFor(person).addClass("chip--active"), elapsed);
      if (i < order.length - 1) {
        window.setTimeout(() => {
          chipFor(person).removeClass("chip--active").addClass("chip--eliminated");
        }, elapsed + FLASH_TIME);
      }
    });

    window.setTimeout(() => {
      chipFor(order[order.length - 1])
        .removeClass("chip--active")
        .addClass("chip--eliminated");
      chipFor(winner).addClass("chip--winner");
    }, elapsed + FLASH_TIME);

    window.setTimeout(() => finishSpin(winner), DURATIONS.focus);
  }

  function spinWheel(winner) {
    const count = availablePeople.length;
    const arc = (Math.PI * 2) / count;
    const index = availablePeople.findIndex((p) => p.id === winner.id);
    const jitter = (Math.random() - 0.5) * arc * 0.7;
    const target = -Math.PI / 2 - (index + 0.5) * arc + jitter;
    const fullTurn = Math.PI * 2;
    const start = wheelAngle;
    const delta =
      ((((target - start) % fullTurn) + fullTurn) % fullTurn) + fullTurn * 6;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / DURATIONS.wheel, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      wheelAngle = start + delta * eased;
      drawWheel();
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        wheelAngle = (start + delta) % fullTurn;
        finishSpin(winner);
      }
    }
    window.requestAnimationFrame(frame);
  }

  function spin() {
    if (isSpinning || availablePeople.length === 0) {
      return;
    }

    isSpinning = true;
    $stageName.removeClass("stage__name--ticking stage__name--revealed").text("");
    render();
    updateMessage();

    const winner = pickRandom(availablePeople);
    if (availablePeople.length === 1 && mode !== "classic") {
      window.setTimeout(() => finishSpin(winner), 600);
    } else if (mode === "focus") {
      spinFocus(winner);
    } else if (mode === "wheel") {
      spinWheel(winner);
    } else {
      spinClassic(winner);
    }
  }

  function setMode(newMode) {
    if (isSpinning || !(newMode in DURATIONS) || newMode === mode) {
      return;
    }
    mode = newMode;
    saveMode();
    $stageName.removeClass("stage__name--ticking stage__name--revealed").text("");
    renderStageView();
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
  $modeOptions.on("click", (event) => setMode($(event.currentTarget).attr("data-mode")));
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
