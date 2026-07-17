const MODES = Object.freeze({
  PARTY: "party",
  GUEST: "guest"
});

function createQueueEngine(initialMode = MODES.PARTY) {
  let mode =
    initialMode === MODES.GUEST
      ? MODES.GUEST
      : MODES.PARTY;

  function getMode() {
    return mode;
  }

  function handleGuestRequest() {
    if (mode === MODES.PARTY) {
      mode = MODES.GUEST;
      console.log("[QUEUE] PARTY -> GUEST");

      return {
        firstGuestRequest: true,
        enqueue: "replace"
      };
    }

    console.log("[QUEUE] Added request to guest queue");

    return {
      firstGuestRequest: false,
      enqueue: "add"
    };
  }

  function completeGuestSession() {
    if (mode !== MODES.GUEST) {
      return false;
    }

    mode = MODES.PARTY;
    console.log("[QUEUE] GUEST -> PARTY");
    return true;
  }

  function resetToParty() {
    mode = MODES.PARTY;
  }

  return {
    getMode,
    handleGuestRequest,
    completeGuestSession,
    resetToParty,
    isPartyMode: () => mode === MODES.PARTY,
    isGuestMode: () => mode === MODES.GUEST
  };
}

module.exports = {
  MODES,
  createQueueEngine
};
