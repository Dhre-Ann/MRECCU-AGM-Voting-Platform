// Local/LAN: talk to Express on :3000. If the page itself is served by Express (:3000),
// use same origin. Live Server (:5500) etc. must NOT use window.location.origin.
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.');

const API_BASE_URL = !isLocalHost
  ? 'https://mreccu-agm-voting-platform.onrender.com'
  : (window.location.port === '3000'
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3000`);

function apiFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
  });
}


// Protect admin page
if (window.location.pathname.includes('admin.html')) {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin) {
    window.location.href = './dashboard.html'; // Redirect non-admins
  }
}

// Variables
const loginRedirect = document.getElementById("login-redirect-btn");
const phoneInput = document.getElementById('phoneNumber');
const accountInput = document.getElementById('accountNumber');
const voterLoginForm = document.getElementById('voterForm');
const resultDiv = document.getElementById('result');
const voterId = localStorage.getItem('voterId') || "null";

// login button
if (loginRedirect) {
  loginRedirect.addEventListener("click", () => {
    window.location.href = "./pages/login.html";
  });
}

// Phone number formatting for login
if (phoneInput) {
  phoneInput.placeholder = "123-4567"; // Set placeholder
  phoneInput.addEventListener('input', (e) => {
    clearLoginError();
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length > 3) {
      value = value.slice(0, 3) + '-' + value.slice(3, 7); // Format as 123-4567
    }
    e.target.value = value;
  });
}

// Account number formatting for login
if (accountInput) {
  accountInput.placeholder = "12345";

  accountInput.addEventListener('input', (e) => {
    clearLoginError();
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    value = value.slice(0, 5); // Limit to 5 digits
    e.target.value = value;
  });
}

function showLoginError(message) {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
    return;
  }
  alert(message);
}

function clearLoginError() {
  const loginError = document.getElementById('loginError');
  if (loginError) {
    loginError.textContent = '';
    loginError.classList.add('hidden');
  }
}

// verify user
if (voterLoginForm) {
  voterLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearLoginError();

    const phone_number = document.getElementById('phoneNumber').value;
    const account_number = document.getElementById('accountNumber').value;
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    // if (!/^\d{5}$/.test(account_number)) {
    //   alert("Account number must be exactly 5 digits.");
    //   return;
    // }

    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.textContent = 'Signing in…';
    }

    try {
      const response = await apiFetch('/verify-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, account_number }),
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('voterId', data.voterId);
        localStorage.setItem('isAdmin', data.isAdmin); // ✅ Store admin flag

        // ✅ Redirect based on isAdmin
        if (data.isAdmin) {
          window.location.href = './admin.html';
        } else {
          window.location.href = './dashboard.html';
        }

      } else {
        showLoginError(data.message || 'Invalid phone number or account number. Please try again.');
      }
    } catch (error) {
      console.error(error);
      showLoginError('Unable to reach the voting server. Check your connection and try again.');
    } finally {
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = 'Continue to Voting';
      }
    }
  });
}


// ====================================== ADMIN DASH ======================================

const toggleUploadBtn = document.getElementById('toggleUploadCSV');
const uploadCSVSection = document.getElementById('uploadCSVSection');

if (toggleUploadBtn) {
  toggleUploadBtn.addEventListener('click', () => {
    uploadCSVSection.classList.toggle('hidden');
  });
}
const toggleVoting = document.getElementById('toggleVotingSectionBtn');
const toggleVotingSection = document.getElementById('toggleVotingSection');

if (toggleVoting) {
  toggleVoting.addEventListener('click', () => {
    toggleVotingSection.classList.toggle('hidden');
  });
}

const toggleVotingBtn = document.getElementById('toggleVotingBtn');
const votingInactiveMsg = document.getElementById('votingInactiveMsg');
const votingStatusText = document.getElementById('votingStatusText');
const votingStats = document.getElementById('votingStats');
const positionSelect = document.getElementById('positionSelect');
const candidateNameInput = document.getElementById('candidateName');
const candidateOccupationInput = document.getElementById('candidateOccupation');
const addCandidateBtn = document.getElementById('addCandidateBtn');
const candidateList = document.getElementById('candidateList');
let previousVotingActive = null;

const START_VOTING_BTN_CLASS =
  'min-h-11 rounded-lg bg-primary px-4 py-2 text-ui font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';
const STOP_VOTING_BTN_CLASS =
  'min-h-11 rounded-lg bg-error px-4 py-2 text-ui font-semibold text-white transition hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50';
const START_VOTING_PANEL_CLASS =
  'space-y-3 rounded-xl border border-border bg-canvas/60 p-4 text-center';
const STOP_VOTING_PANEL_CLASS =
  'space-y-3 rounded-xl border border-border bg-canvas/60 p-4 text-center';

function setToggleVotingAppearance(isActive) {
  if (!toggleVotingBtn) return;
  const wasDisabled = toggleVotingBtn.disabled;
  toggleVotingBtn.textContent = isActive ? 'Stop Voting' : 'Start Voting';
  toggleVotingBtn.className = isActive ? STOP_VOTING_BTN_CLASS : START_VOTING_BTN_CLASS;
  toggleVotingBtn.disabled = wasDisabled;
  if (toggleVotingSection) {
    const isCollapsed = toggleVotingSection.classList.contains('hidden');
    toggleVotingSection.className = isActive ? STOP_VOTING_PANEL_CLASS : START_VOTING_PANEL_CLASS;
    if (isCollapsed) toggleVotingSection.classList.add('hidden');
  }
}


// Toggle voting start and stop
async function updateToggleVotingButtonState() {
  if (!positionSelect) return;

  const selectedPosition = positionSelect.value;

  if (!selectedPosition || selectedPosition === 'Select') return;

  try {
    const res = await fetch(`${API_BASE_URL}/voting/status?position_name=${encodeURIComponent(selectedPosition)}`);
    const data = await res.json();

    if (!data.success) {
      console.warn(data.message || 'Unable to fetch voting status.');
      return;
    }

    // Set the button and UI state based on voting_active
    if (data.voting_active) {
      setToggleVotingAppearance(true);
      votingInactiveMsg.classList.add('hidden');
      votingStatusText.classList.remove('hidden');
      votingStats.classList.remove('hidden');
      loadActiveVoting(); // Update stats if voting is ongoing
    } else {
      setToggleVotingAppearance(false);
      votingStats.classList.add('hidden');
      votingStatusText.classList.add('hidden');
      votingInactiveMsg.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error checking voting status:', err);
  }
}

if (toggleVotingBtn){
  toggleVotingBtn.addEventListener('click', async () => {
  const selectedPosition = positionSelect.value;

  if (!selectedPosition || selectedPosition === 'Select') {
    alert('Please select a position first.');
    return;
  }

  try {
    if (toggleVotingBtn.textContent === 'Start Voting') {
      // Attempt to start voting
      const response = await apiFetch('/voting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_name: selectedPosition })
      });

      const data = await response.json();

      if (data.success) {
        setToggleVotingAppearance(true);
        votingInactiveMsg.classList.add('hidden');
        votingStatusText.classList.remove('hidden');
        votingStats.classList.remove('hidden');
        updateToggleVotingButtonState();
        loadActiveVoting();
      } else {
        alert(data.message || 'Unable to start voting.');
      }

    } else {
      // Stop voting
      const response = await apiFetch('/voting/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_name: selectedPosition })
      });

      const data = await response.json();

      if (data.success) {
        setToggleVotingAppearance(false);
        votingStats.classList.add('hidden');
        votingStatusText.classList.add('hidden');
        votingInactiveMsg.classList.remove('hidden');
        updateToggleVotingButtonState();
        loadVotingHistory();
        loadActiveVoting();
      } else {
        alert(data.message || 'Unable to stop voting.');
      }
    }
  } catch (error) {
    console.error('Error toggling voting:', error);
    alert('An error occurred. Please try again.');
  }
});
}

// ---------------------------- ACTIVE VOTING CONFIG LOGIC ----------------------------

if (addCandidateBtn){
  addCandidateBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  const positionName = positionSelect.value;
  const candidateName = candidateNameInput.value.trim();
  const candidateOccupation = candidateOccupationInput.value.trim();

  if (!positionName || !candidateName || !candidateOccupation) {
    alert('Please fill out all fields.');
    return;
  }

  try {
    const response = await apiFetch('/add-candidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionName, candidateName, candidateOccupation })
    });

    if (response.ok) {
      candidateNameInput.value = '';
      candidateOccupationInput.value = '';
      await loadCandidates(positionName);  // Refresh the list
    } else {
      console.error(await response.text());
      alert('Error adding candidate.');
    }
  } catch (err) {
    console.error(err);
    alert('Server error.');
  }
});
}

// Function to fetch and display candidates for selected position
async function loadCandidates(positionName) {
  const response = await fetch(`${API_BASE_URL}/get-candidates?position=${encodeURIComponent(positionName)}`);
  const data = await response.json();

  candidateList.innerHTML = ''; // Clear the list first

  data.candidates.forEach(candidate => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas/60 px-3 py-2.5';
    
    const span = document.createElement('span');
    span.textContent = `${candidate.name} (${candidate.occupation})`;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'shrink-0 text-caption font-semibold text-error hover:underline';
    removeBtn.addEventListener('click', () => removeCandidate(candidate.id, positionName));
    
    li.appendChild(span);
    li.appendChild(removeBtn);
    
    candidateList.appendChild(li);
  });
}

// Function to remove a candidate by ID
async function removeCandidate(candidateId, positionName) {
  const confirmed = confirm('Are you sure you want to remove this candidate?');
  if (!confirmed) return;

  try {
    const response = await apiFetch(`/remove-candidate/${candidateId}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      await loadCandidates(positionName);
    } else {
      alert('Failed to remove candidate.');
    }
  } catch (err) {
    console.error(err);
    alert('Server error.');
  }
}

// Automatically load candidates when position changes
if (positionSelect){
  positionSelect.addEventListener('change', () => {
  const selected = positionSelect.value;
  if (selected !== 'Select') {
    loadCandidates(selected);
    loadActiveVoting();
    updateToggleVotingButtonState();
  } else {
    candidateList.innerHTML = ''; // Clear if no position selected
  }
});
}


// SET NUMBER OF VOTES ALLOWED:
document.addEventListener('DOMContentLoaded', () => {
  const positionSelect = document.getElementById('positionSelect');
  const votesAllowedText = document.getElementById('votesAllowedText');
  const setVotesAllowedBtn = document.getElementById('setVotesAllowedBtn');

  let currentPositionId = null; // To store the ID or name of the current position

  // When a position is selected
  if (positionSelect){
    positionSelect.addEventListener('change', async () => {
    const positionName = positionSelect.value;

    // Fetch the position from the backend
    try {
      const response = await fetch(`${API_BASE_URL}/get-position-name?name=${encodeURIComponent(positionName)}`);
      const data = await response.json();

      if (data.success) {
        currentPositionId = data.position.id; // Save the position ID for future updates
        if (data.position.num_votes_allowed !== null) {
          votesAllowedText.textContent = data.position.num_votes_allowed;
          setVotesAllowedBtn.textContent = 'Edit';
        } else {
          votesAllowedText.textContent = 'Not Set';
          setVotesAllowedBtn.textContent = 'Set';
        }
      } else {
        votesAllowedText.textContent = 'Error fetching position';
        setVotesAllowedBtn.textContent = 'Retry';
      }
    } catch (error) {
      console.error('Error fetching position data:', error);
      votesAllowedText.textContent = 'Error';
      setVotesAllowedBtn.textContent = 'Retry';
    }
  });
  }

  // Handle Set/Edit button click
  if (setVotesAllowedBtn){
  setVotesAllowedBtn.addEventListener('click', () => {
      // Replace the span with an input field
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 1;
      input.value = (votesAllowedText.textContent !== 'Not Set' && votesAllowedText.textContent !== 'Error') 
        ? votesAllowedText.textContent 
        : '';
      input.className = 'inline-flex min-h-11 min-w-28 items-center rounded-lg border border-border px-4 text-center text-ui text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';
      saveBtn.className = 'inline-flex min-h-11 min-w-28 items-center justify-center rounded-lg bg-primary px-4 text-ui font-semibold text-white transition hover:bg-primary-hover';

      const container = votesAllowedText.parentElement;
      container.replaceChild(input, votesAllowedText);
      setVotesAllowedBtn.style.display = 'none';
      container.appendChild(saveBtn);

      saveBtn.addEventListener('click', async () => {
        const newVotes = parseInt(input.value);
        if (isNaN(newVotes) || newVotes <= 0) {
          alert('Please enter a valid positive number.');
          return;
        }

        // Send to server to save
        try {
          const response = await apiFetch('/update-votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: currentPositionId,
              num_votes_allowed: newVotes
            })
          });

          const result = await response.json();
          if (result.success) {
            votesAllowedText.textContent = newVotes;
            container.replaceChild(votesAllowedText, input);
            saveBtn.remove();
            setVotesAllowedBtn.textContent = 'Edit';
            setVotesAllowedBtn.style.display = '';
          } else {
            alert('Failed to update. Please try again.');
          }
        } catch (error) {
          console.error('Error updating number of votes:', error);
          alert('Error updating number of votes.');
        }
      });
    });
  }
});

// function to load voting status (loads last saved state)
async function loadVotingStatus(positionName) {
  if (!positionName || positionName === 'Select') {
    toggleVotingBtn.disabled = true;
    setToggleVotingAppearance(false);
    votingStats.classList.add('hidden');
    votingInactiveMsg.classList.remove('hidden');
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/voting/status?position_name=${encodeURIComponent(positionName)}`);
    const data = await response.json();

    if (data.success) {
      if (data.voting_active) {
        setToggleVotingAppearance(true);
        votingStats.classList.remove('hidden');
        votingInactiveMsg.classList.add('hidden');
        votingStatusText.classList.remove('hidden');
        loadLiveVotingStats(positionName);
        setInterval(() => loadLiveVotingStats(positionName), 3000);
      } else {
        setToggleVotingAppearance(false);
        votingStats.classList.add('hidden');
        votingInactiveMsg.classList.remove('hidden');
        votingStatusText.classList.add('hidden');
      }
      toggleVotingBtn.disabled = false;
    } else {
      console.error(data.message);
      toggleVotingBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error fetching voting status:', error);
    toggleVotingBtn.disabled = true;
  }
}

// ====================================== USER DASH ======================================

const votingStatusMsg = document.getElementById('votingStatusMsg');
const votingSection = document.getElementById('votingSection');
const positionTitle = document.getElementById('positionTitle');
const votesAllowedText = document.getElementById('votesAllowedText');
const candidatesGrid = document.getElementById('candidatesGrid');
const voteLimitNote = document.getElementById('voteLimitNote');
const voteForm = document.getElementById('voteForm');
const submitVoteBtn = document.getElementById('submitVoteBtn');
let positionForVote = null;
let hasVotedFlag = false;

function showVoteFeedback(message, type = 'error') {
  const voteFeedback = document.getElementById('voteFeedback');
  if (!voteFeedback) {
    alert(message);
    return;
  }

  voteFeedback.textContent = message;
  voteFeedback.classList.remove('hidden', 'border-error/30', 'bg-error-soft', 'text-error', 'border-success/30', 'bg-success-soft', 'text-success');

  if (type === 'success') {
    voteFeedback.classList.add('border-success/30', 'bg-success-soft', 'text-success');
  } else {
    voteFeedback.classList.add('border-error/30', 'bg-error-soft', 'text-error');
  }
}

function clearVoteFeedback() {
  const voteFeedback = document.getElementById('voteFeedback');
  if (voteFeedback) {
    voteFeedback.textContent = '';
    voteFeedback.classList.add('hidden');
  }
}

function updateVotedUi(hasVoted) {
  const votedBanner = document.getElementById('votedBanner');
  if (votedBanner) {
    votedBanner.classList.toggle('hidden', !hasVoted);
  }
  if (submitVoteBtn) {
    submitVoteBtn.disabled = !!hasVoted;
    submitVoteBtn.textContent = hasVoted ? 'Vote Recorded' : 'Cast Vote';
  }
}

async function submitVoteForm(activePosition){

  const selected = Array.from(voteForm.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => parseInt(cb.value));

  clearVoteFeedback();

  if (selected.length === 0) {
    showVoteFeedback('Please select at least one candidate to vote.');
    return;
  }

  if (submitVoteBtn) {
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = 'Submitting…';
  }

  try {
    const response = await fetch(`${API_BASE_URL}/voting/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voterId,
        position: activePosition,
        selectedCandidates: selected,
      }),
    });

    const data = await response.json();

    if (data.success) {
      hasVotedFlag = true;
      updateVotedUi(true);
      showVoteFeedback('Thank you! Your vote has been recorded.', 'success');
      if (voteForm){
        voteForm.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);
      }      
      await loadActiveVoting();
      await loadLiveVotingStats(activePosition);
    } else {
      // add checks for status 403
      if (response.status === 403) {
      showVoteFeedback(data.message || 'You have already voted for this position.');
      updateVotedUi(true);
      return;
      } else if (response.status === 400){
        showVoteFeedback(data.message || 'Please select the right number of candidates');
        if (submitVoteBtn) {
          submitVoteBtn.disabled = false;
          submitVoteBtn.textContent = 'Cast Vote';
        }
        return;
      }
      showVoteFeedback(data.message || 'Unable to record your vote.');
      if (submitVoteBtn) {
        submitVoteBtn.disabled = false;
        submitVoteBtn.textContent = 'Cast Vote';
      }
    }
  } catch (err) {
    console.error(err);
    showVoteFeedback('An error occurred while submitting your vote.');
    if (submitVoteBtn) {
      submitVoteBtn.disabled = false;
      submitVoteBtn.textContent = 'Cast Vote';
    }
  }
}

async function monitorVotingStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/voting/get-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }), // assumes you have voterId globally
    });

    const data = await res.json();
    const currentVotingActive = !!data.position; // true if a position is active

    if (previousVotingActive === null) {
      previousVotingActive = currentVotingActive;
    } else if (currentVotingActive !== previousVotingActive) {
      console.log('Voting status changed. Reloading...');
      previousVotingActive = currentVotingActive;
      await loadActiveVoting(); // this will repopulate based on actual active position
    }

  } catch (err) {
    console.error('Error monitoring voting status:', err);
  }
}




async function loadActiveVoting() {
  try {
    const res = await fetch(`${API_BASE_URL}/voting/get-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }),
    });

    if (!res.ok) throw new Error('Failed to load active voting.');

    const data = await res.json();

    if (!data.success || !data.position) {
      if (votingSection){
        votingSection.classList.add('hidden');
        votingStatusMsg.classList.remove('hidden');
        votingStatusMsg.innerHTML = `
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <span class="text-title font-bold" aria-hidden="true">…</span>
          </div>
          <h2 class="text-title font-bold text-primary">No active race right now</h2>
          <p class="mx-auto mt-2 max-w-sm text-ui text-ink-muted">
            Voting will begin soon. Keep this page open — the ballot appears automatically when staff start a race.
          </p>
        `;
      }
      updateVotedUi(false);
      clearVoteFeedback();
      return;
    }

    const { position, num_votes_allowed, candidates } = data;
    hasVotedFlag = data.hasVoted;
    positionForVote = position;

    if (positionTitle){
      positionTitle.textContent = position;
      votesAllowedText.innerHTML = `Select <strong>${num_votes_allowed}</strong> out of the ${candidates.length} candidates below.`;
      voteLimitNote.textContent = `You can only select up to ${num_votes_allowed} candidate(s) for this position.`;
    
    candidatesGrid.innerHTML = ''; // Clear grid before populating

    candidates.forEach((candidate) => {
      const label = document.createElement('label');
      label.className = 'flex min-h-[56px] items-start gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-accent hover:bg-accent-soft/40 has-[:checked]:border-accent has-[:checked]:bg-accent-soft cursor-pointer';
      label.innerHTML = `
        <input type="checkbox" name="${position}" value="${candidate.id}" class="mt-1 h-5 w-5 shrink-0 accent-accent" />
        <div class="text-left">
          <p class="font-semibold text-primary">${candidate.name}</p>
          <p class="text-caption text-ink-muted">${candidate.occupation || ''}</p>
        </div>
      `;
      candidatesGrid.appendChild(label);
    });
  }

    // ✅ Disable checkboxes only if user has already voted
    if (candidatesGrid){
      const checkboxes = candidatesGrid.querySelectorAll('input[type="checkbox"]');
      console.log('has user voted: ', hasVotedFlag);
      // checkboxes.forEach(cb => cb.disabled = hasVotedFlag);
      checkboxes.forEach(cb => {
        cb.disabled = hasVotedFlag;
        console.log('Checkbox', cb.value, 'disabled:', cb.disabled);
      });
  }
    updateVotedUi(hasVotedFlag);
    if (!hasVotedFlag) {
      clearVoteFeedback();
    }
    if (votingStatusMsg && votingSection){
      votingStatusMsg.classList.add('hidden');
      votingSection.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    if (votingStatusMsg){
      votingStatusMsg.innerHTML = `
        <h2 class="text-title font-bold text-error">Unable to load ballot</h2>
        <p class="mx-auto mt-2 max-w-sm text-ui text-ink-muted">
          Check your connection and refresh the page. If the problem continues, notify a staff member.
        </p>
      `;
      votingStatusMsg.classList.remove('hidden');
    }
    if (votingSection) {
      votingSection.classList.add('hidden');
    }
  }
}

// Function to load Voting History
async function loadVotingHistory() {
  console.log('load voting history called');
  const historyList = document.getElementById('votingHistoryList');

  if (historyList) {
    historyList.innerHTML = '';

    try {
      const res = await fetch(`${API_BASE_URL}/voting/history`);
      const data = await res.json();

      if (data.success && data.history.length > 0) {
        // ✅ Check if ALL positions are completed
        const allCompleted = data.history.length === data.totalPositionsCount;
        console.log("All positions completed?", allCompleted);

        data.history.forEach(item => {
          const li = document.createElement('li');
          li.className = 'rounded-xl border border-border bg-canvas/50 p-3 space-y-2';

          const maxVotes = Math.max(1, ...item.candidates.map(c => Number(c.vote_count) || 0));

          // Build candidate vote list with simple bars
          const candidateList = item.candidates.map(c => {
            const count = Number(c.vote_count) || 0;
            const barPercent = Math.round((count / maxVotes) * 100);
            return `
            <div class="space-y-1">
              <div class="flex justify-between gap-2 text-caption">
                <span>${c.name}</span>
                <span class="font-semibold text-primary">${count}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                <div class="h-1.5 rounded-full bg-accent" style="width: ${barPercent}%"></div>
              </div>
            </div>
          `;
          }).join('');

          li.innerHTML = `
            <strong class="text-body text-primary">${item.name}</strong>
            <div class="mt-2 space-y-2">${candidateList}</div>
          `;
          historyList.appendChild(li);
        });        
      } else {
        historyList.innerHTML = '<li class="text-center text-ui italic text-ink-muted">No completed voting sessions yet.</li>';
      }

    } catch (err) {
      console.error(err);
      historyList.innerHTML = '<li>Error loading voting history.</li>';
    }
  }
}



async function loadLiveVotingStats(positionName) {

  if (!positionName || positionName === 'null') {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/voting/live-stats?position_name=${encodeURIComponent(positionName)}`);
    const data = await response.json();

    if (!data.success) {
      console.error(data.message);
      return;
    }

    // Update Progress Bar → ✅ Percentage of voters who voted
    const percent = data.totalVoters === 0 ? 0 : Math.round((data.votersWhoVoted / data.totalVoters) * 100);
    const progressBar = document.getElementById('votesProgress');
    if (progressBar){
      progressBar.style.width = `${percent}%`;
    }
    

    // ✅ Show number of voters who have voted
    if (document.getElementById('votesCount')){
      document.getElementById('votesCount').textContent = data.votersWhoVoted;
      document.getElementById('votesTotal').textContent = data.totalVoters;
    }
    

    // Update candidate votes breakdown
    const candidateVotes = document.getElementById('candidateVotes');
    if (!candidateVotes) return;

    candidateVotes.innerHTML = '';

    const maxVotes = Math.max(1, ...data.candidates.map(c => Number(c.vote_count) || 0));

    data.candidates.forEach(candidate => {
      const count = Number(candidate.vote_count) || 0;
      const barPercent = Math.round((count / maxVotes) * 100);
      const div = document.createElement('div');
      div.className = 'space-y-1';
      div.innerHTML = `
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-medium text-ink">${candidate.name}</span>
          <span class="shrink-0 text-caption font-semibold text-primary">${count} vote${count === 1 ? '' : 's'}</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-border/60">
          <div class="h-2.5 rounded-full bg-primary transition-all duration-300" style="width: ${barPercent}%"></div>
        </div>
      `;
      candidateVotes.appendChild(div);
    });

  } catch (err) {
    console.error('Error fetching live voting stats:', err);
  }
}



document.addEventListener('DOMContentLoaded', () => {
  loadActiveVoting(); // Run immediately on page load
  loadVotingHistory();
  loadLiveVotingStats(positionForVote); 
  updateToggleVotingButtonState(); 
  monitorVotingStatus();

  setInterval(() => {
    monitorVotingStatus();
    loadLiveVotingStats(positionForVote);
  }, 3000); // check every 8 seconds (adjust as needed)
});

// Event listener to allow voting
if (voteForm && submitVoteBtn){
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitVoteForm(positionForVote);
  });
}


// ====================================== ADDING MANUAL VOTES ======================================

const openPollModalBtn = document.getElementById('openPollModalBtn');
const pollResultsModal = document.getElementById('pollResultsModal');
const manualVotesForm = document.getElementById('manualVotesForm');
const cancelPollBtn = document.getElementById('cancelPollBtn');
const submitPollBtn = document.getElementById('submitPollBtn');

let lastCompletedPosition = null;

async function loadCompletedPositionForPolling() {
  try {
    const res = await fetch(`${API_BASE_URL}/voting/history`);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.history)) return;

    manualVotesForm.innerHTML = ''; // Clear existing form

data.history.forEach(pos => {
  if (pos.voting_complete) {
    const section = document.createElement('div');
    section.className = 'mb-4';

    const title = document.createElement('h3');
    title.className = 'font-bold text-primary text-lg mb-2';
    title.textContent = pos.name;
    section.appendChild(title);

    pos.candidates.forEach(candidate => {
      const div = document.createElement('div');
      div.className = 'flex justify-between items-center space-x-2';

      div.innerHTML = `
        <label class="flex-1 text-primary">${candidate.name}</label>
        <input type="number"
               name="manualVote_${pos.name}_${candidate.name}"
               min="0" value="0"
               class="w-20 p-1 border border-gray-300 rounded"
               ${pos.paper_results_added ? 'disabled' : ''} />
      `;
      section.appendChild(div);
    });

    manualVotesForm.appendChild(section);
  }
});


    pollResultsModal.classList.remove('hidden');

  } catch (err) {
    console.error('Error loading polling form:', err);
    alert('Failed to load polling form.');
  }
}




// Button actions
openPollModalBtn?.addEventListener('click', loadCompletedPositionForPolling);
cancelPollBtn?.addEventListener('click', () => pollResultsModal.classList.add('hidden'));

submitPollBtn?.addEventListener('click', async (e) => {
  e.preventDefault();

  const inputs = manualVotesForm.querySelectorAll('input[type="number"]');
  const resultsByPosition = {}; // { position_name: [{ candidateName, count }] }

  inputs.forEach(input => {
    const [_, positionName, candidateName] = input.name.split('_');
    const count = parseInt(input.value) || 0;

    if (count > 0) {
      if (!resultsByPosition[positionName]) {
        resultsByPosition[positionName] = [];
      }
      resultsByPosition[positionName].push({ candidateName, count });
    }
  });

  try {
    const res = await apiFetch('/voting/poll-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultsByPosition }),
    });

    const data = await res.json();
    if (data.success) {
      alert('Paper results added successfully!');
      pollResultsModal.classList.add('hidden');

      loadVotingHistory();

    } else {
      alert(`Error: ${data.message}`);
    }

  } catch (err) {
    console.error('Error submitting poll results:', err);
    alert('An error occurred.');
  }
});



// Upload CSV file with voters
const uploadBtn = uploadCSVSection?.querySelector('button');
const fileInput = uploadCSVSection?.querySelector('input[type="file"]');

if (uploadBtn){
  uploadBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const fileInput = document.querySelector('#uploadCSVSection input[type="file"]');
    const file = fileInput?.files[0];

    if (!file) {
      alert('Please select a CSV file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('csv', file);

    try {
      const res = await apiFetch('/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      console.log(res.json);

      if (res.ok && data.success) {
        alert(`CSV uploaded successfully. ${data.inserted} voters added.`);
        fileInput.value = ''; // Reset input
      } else {
        console.error('Upload failed:', data);
        alert(data.message || 'An error occurred while uploading CSV file.');
      }
    } catch (err) {
      console.error('Network error:', err);
      alert('A network error occurred while uploading CSV file.');
    }
  });
}


// ====================================== ADMIN TABS + NEW TOOLS ======================================

const ADMIN_TAB_KEY = 'adminActiveTab';
const ADMIN_TAB_IDS = ['setup', 'activity', 'voters', 'results', 'emergency'];
const TAB_IDLE =
  'admin-tab min-h-11 rounded-lg px-3 py-2 text-ui font-semibold text-ink-muted transition hover:bg-accent-soft hover:text-primary';
const TAB_ACTIVE =
  'admin-tab min-h-11 rounded-lg bg-accent-soft px-3 py-2 text-ui font-semibold text-primary';
const TAB_EMERGENCY_IDLE =
  'admin-tab admin-tab-emergency min-h-11 rounded-lg px-3 py-2 text-ui font-semibold text-warning transition hover:bg-warning-soft';
const TAB_EMERGENCY_ACTIVE =
  'admin-tab admin-tab-emergency min-h-11 rounded-lg bg-warning-soft px-3 py-2 text-ui font-semibold text-error';

let currentAdminTab = 'setup';

function showAdminTab(tabId) {
  if (!ADMIN_TAB_IDS.includes(tabId)) tabId = 'setup';
  currentAdminTab = tabId;

  document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.adminPanel !== tabId);
  });

  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    const isActive = btn.dataset.adminTab === tabId;
    const isEmergency = btn.dataset.adminTab === 'emergency';
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isEmergency) {
      btn.className = isActive ? TAB_EMERGENCY_ACTIVE : TAB_EMERGENCY_IDLE;
    } else {
      btn.className = isActive ? TAB_ACTIVE : TAB_IDLE;
    }
  });

  try {
    sessionStorage.setItem(ADMIN_TAB_KEY, tabId);
  } catch (_) { /* ignore */ }

  if (tabId === 'results') {
    loadResultsDashboard();
  }
  if (tabId === 'emergency') {
    refreshPositionResetCard();
  }
}

const adminTabButtons = document.querySelectorAll('[data-admin-tab]');
if (adminTabButtons.length) {
  let initialTab = 'setup';
  try {
    const stored = sessionStorage.getItem(ADMIN_TAB_KEY);
    if (ADMIN_TAB_IDS.includes(stored)) initialTab = stored;
  } catch (_) { /* ignore */ }

  showAdminTab(initialTab);

  adminTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => showAdminTab(btn.dataset.adminTab));
  });

  setInterval(() => {
    if (currentAdminTab === 'results') loadResultsDashboard();
    if (currentAdminTab === 'emergency') refreshPositionResetCard();
  }, 5000);
}

// ----- Voter Management -----

const voterSearchForm = document.getElementById('voterSearchForm');
const voterSearchInput = document.getElementById('voterSearchInput');
const voterSearchResults = document.getElementById('voterSearchResults');
const voterSearchStatus = document.getElementById('voterSearchStatus');
const addVoterForm = document.getElementById('addVoterForm');
const addVoterStatus = document.getElementById('addVoterStatus');

function setVoterSearchStatus(message, kind = 'muted') {
  if (!voterSearchStatus) return;
  voterSearchStatus.textContent = message;
  voterSearchStatus.className =
    kind === 'error'
      ? 'text-center text-caption text-error'
      : kind === 'success'
        ? 'text-center text-caption text-success'
        : 'text-center text-caption text-ink-muted';
}

function setAddVoterStatus(message, kind = 'muted') {
  if (!addVoterStatus) return;
  addVoterStatus.textContent = message;
  addVoterStatus.className =
    kind === 'error'
      ? 'text-center text-caption text-error'
      : kind === 'success'
        ? 'text-center text-caption text-success'
        : 'text-center text-caption text-ink-muted';
}

function votedBadge(hasVoted) {
  const span = document.createElement('span');
  if (hasVoted) {
    span.className = 'rounded-md bg-success-soft px-2 py-0.5 text-caption font-semibold text-success';
    span.textContent = 'Voted';
  } else {
    span.className = 'rounded-md bg-canvas px-2 py-0.5 text-caption font-semibold text-ink-muted';
    span.textContent = 'Not voted';
  }
  return span;
}

function renderVoterRow(voter) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-border/70';
  tr.dataset.voterId = String(voter.id);

  const phoneTd = document.createElement('td');
  phoneTd.className = 'px-2 py-2 font-mono text-caption';
  phoneTd.textContent = voter.phone_number;

  const accountTd = document.createElement('td');
  accountTd.className = 'px-2 py-2 font-mono text-caption';
  accountTd.textContent = voter.account_number;

  const statusTd = document.createElement('td');
  statusTd.className = 'px-2 py-2';
  statusTd.appendChild(votedBadge(voter.has_voted));

  const actionsTd = document.createElement('td');
  actionsTd.className = 'px-2 py-2 text-right';
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'text-caption font-semibold text-primary hover:underline';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => startVoterEdit(tr, voter));
  actionsTd.appendChild(editBtn);

  tr.append(phoneTd, accountTd, statusTd, actionsTd);
  return tr;
}

function startVoterEdit(tr, voter) {
  tr.innerHTML = '';

  const phoneTd = document.createElement('td');
  phoneTd.className = 'px-2 py-2';
  const phoneInputEl = document.createElement('input');
  phoneInputEl.type = 'text';
  phoneInputEl.value = voter.phone_number;
  phoneInputEl.className = 'min-h-10 w-full rounded-lg border border-border px-2 py-1 text-caption';
  phoneTd.appendChild(phoneInputEl);

  const accountTd = document.createElement('td');
  accountTd.className = 'px-2 py-2';
  const accountInputEl = document.createElement('input');
  accountInputEl.type = 'text';
  accountInputEl.value = voter.account_number;
  accountInputEl.className = 'min-h-10 w-full rounded-lg border border-border px-2 py-1 text-caption';
  accountTd.appendChild(accountInputEl);

  const statusTd = document.createElement('td');
  statusTd.className = 'px-2 py-2';
  statusTd.appendChild(votedBadge(voter.has_voted));

  const actionsTd = document.createElement('td');
  actionsTd.className = 'px-2 py-2 text-right';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'mr-2 text-caption font-semibold text-accent hover:underline';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'text-caption font-semibold text-ink-muted hover:underline';
  cancelBtn.textContent = 'Cancel';

  saveBtn.addEventListener('click', async () => {
    const phone_number = phoneInputEl.value.trim();
    const account_number = accountInputEl.value.trim();
    if (!phone_number || !account_number) {
      setVoterSearchStatus('Phone and account number are required.', 'error');
      return;
    }

    saveBtn.disabled = true;
    try {
      const res = await apiFetch(`/admin/voters/${voter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, account_number }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVoterSearchStatus(data.message || 'Could not update voter.', 'error');
        saveBtn.disabled = false;
        return;
      }
      setVoterSearchStatus('Voter updated.', 'success');
      tr.replaceWith(renderVoterRow(data.voter));
    } catch (err) {
      console.error('Error updating voter:', err);
      setVoterSearchStatus('Network error while updating voter.', 'error');
      saveBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener('click', () => {
    tr.replaceWith(renderVoterRow(voter));
  });

  actionsTd.append(saveBtn, cancelBtn);
  tr.append(phoneTd, accountTd, statusTd, actionsTd);
  phoneInputEl.focus();
}

if (voterSearchForm && voterSearchResults) {
  voterSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = (voterSearchInput?.value || '').trim();
    if (!query) {
      setVoterSearchStatus('Enter a phone or account number to search.', 'error');
      return;
    }

    setVoterSearchStatus('Searching…');
    voterSearchResults.innerHTML = '';

    try {
      const res = await apiFetch(`/admin/voters/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVoterSearchStatus(data.message || 'Search failed.', 'error');
        return;
      }

      if (!data.voters.length) {
        setVoterSearchStatus('No matching voters.', 'muted');
        return;
      }

      data.voters.forEach((voter) => {
        voterSearchResults.appendChild(renderVoterRow(voter));
      });

      const suffix = data.voters.length === 50 ? ' (showing first 50)' : '';
      setVoterSearchStatus(`${data.voters.length} result${data.voters.length === 1 ? '' : 's'}${suffix}.`);
    } catch (err) {
      console.error('Error searching voters:', err);
      setVoterSearchStatus('Network error while searching.', 'error');
    }
  });
}

if (addVoterForm) {
  addVoterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone_number = document.getElementById('addVoterPhone')?.value.trim();
    const account_number = document.getElementById('addVoterAccount')?.value.trim();

    if (!phone_number || !account_number) {
      setAddVoterStatus('Phone number and account number are required.', 'error');
      return;
    }

    const addBtn = document.getElementById('addVoterBtn');
    if (addBtn) addBtn.disabled = true;
    setAddVoterStatus('Adding voter…');

    try {
      const res = await apiFetch('/admin/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, account_number }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddVoterStatus(data.message || 'Could not add voter.', 'error');
        return;
      }

      document.getElementById('addVoterPhone').value = '';
      document.getElementById('addVoterAccount').value = '';
      setAddVoterStatus(
        `Added voter ${data.voter.phone_number} / ${data.voter.account_number}.`,
        'success'
      );
    } catch (err) {
      console.error('Error adding voter:', err);
      setAddVoterStatus('Network error while adding voter.', 'error');
    } finally {
      if (addBtn) addBtn.disabled = false;
    }
  });
}

// ----- Results Dashboard (CSS bars + conic-gradient donut) -----

// Brand/neutral first. success + warning only as overflow (7th/8th+).
const RESULT_SLICE_COLORS = [
  '#343075', // primary
  '#28ace3', // accent
  '#5f5c92', // primary-muted
  '#fbdf13', // highlight
  '#8a87af', // border-strong
  '#9dd5f0', // light4
  '#1f7a4c', // success — overflow only
  '#9a7300', // warning — overflow only
];

function resultSliceColor(index) {
  return RESULT_SLICE_COLORS[index % RESULT_SLICE_COLORS.length];
}

function sumVoteCounts(candidates) {
  return (candidates || []).reduce((sum, c) => sum + (Number(c.vote_count) || 0), 0);
}

function decorateResultCandidates(candidates, { isLive }) {
  const list = candidates || [];
  const totalCast = sumVoteCounts(list);
  const maxVotes = Math.max(0, ...list.map((c) => Number(c.vote_count) || 0));
  const leaders = list.filter((c) => (Number(c.vote_count) || 0) === maxVotes && maxVotes > 0);
  const leaderLabel = !isLive || maxVotes === 0
    ? null
    : (leaders.length === 1 ? 'Leading' : 'Tied');

  return list.map((c, i) => {
    const count = Number(c.vote_count) || 0;
    const sharePct = totalCast === 0 ? 0 : (count / totalCast) * 100;
    const isLeader = Boolean(leaderLabel && count === maxVotes);
    return {
      name: c.name,
      count,
      color: resultSliceColor(i),
      sharePct,
      barPct: maxVotes === 0 ? 0 : Math.round((count / maxVotes) * 100),
      leaderLabel: isLeader ? leaderLabel : null,
    };
  });
}

function buildConicGradient(decorated) {
  const totalCast = decorated.reduce((sum, c) => sum + c.count, 0);
  if (totalCast === 0 || decorated.length === 0) {
    return 'conic-gradient(#cfcddc 0% 100%)';
  }

  let cursor = 0;
  const stops = decorated.map((c, i) => {
    const start = cursor;
    cursor += c.sharePct;
    const end = i === decorated.length - 1 ? 100 : cursor;
    return `${c.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function renderResultsCandidateBars(decorated) {
  return decorated.map((c) => {
    const badge = c.leaderLabel
      ? `<span class="rounded-md bg-highlight-soft px-1.5 py-0.5 text-caption font-semibold text-ink">${c.leaderLabel}</span>`
      : '';
    const shareLabel = `${Math.round(c.sharePct)}%`;
    return `
      <div class="space-y-1">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <span class="flex flex-wrap items-center gap-2 font-medium text-ink">
            ${c.name}
            ${badge}
          </span>
          <span class="shrink-0 text-caption font-semibold text-primary">${c.count} vote${c.count === 1 ? '' : 's'} · ${shareLabel}</span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-border/60">
          <div class="h-2.5 rounded-full transition-all duration-300" style="width: ${c.barPct}%; background-color: ${c.color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderResultsDonut(decorated) {
  const gradient = buildConicGradient(decorated);
  const legend = decorated.map((c) => `
    <li class="flex items-center gap-2 text-caption text-ink">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: ${c.color}"></span>
      <span>${c.name}</span>
    </li>
  `).join('');

  return `
    <div class="flex flex-col items-center gap-3 sm:w-44">
      <div class="relative h-36 w-36 shrink-0">
        <div class="h-full w-full rounded-full" style="background: ${gradient}"></div>
        <div class="absolute inset-[22%] rounded-full bg-canvas"></div>
      </div>
      <ul class="w-full space-y-1">${legend}</ul>
    </div>
  `;
}

function renderLiveStatRow(votersWhoVoted, totalVoters) {
  const percent = totalVoters === 0 ? 0 : Math.round((votersWhoVoted / totalVoters) * 100);
  return `
    <div>
      <div class="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span class="text-caption font-semibold text-ink">Turnout</span>
        <span class="text-caption text-ink-muted">${votersWhoVoted} / ${totalVoters} registered voters (${percent}%)</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-border/60">
        <div class="h-2 rounded-full bg-accent" style="width: ${percent}%"></div>
      </div>
    </div>
  `;
}

function renderCompletedStatRow(votesRecorded, totalVoters) {
  const percent = totalVoters === 0 ? 0 : Math.round((votesRecorded / totalVoters) * 100);
  return `
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <span class="text-caption font-semibold text-ink">Votes recorded / registered voters</span>
      <span class="text-caption text-ink-muted">${votesRecorded} / ${totalVoters}${totalVoters === 0 ? '' : ` (${percent}%)`}</span>
    </div>
  `;
}

function renderResultsCard({ title, badge, badgeClass, statHtml, candidates, isLive }) {
  const empty = !candidates || candidates.length === 0;
  const decorated = decorateResultCandidates(candidates, { isLive });
  return `
    <article class="rounded-xl border border-border bg-canvas/50 p-4 space-y-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-body font-bold text-primary">${title}</h3>
        <span class="rounded-md px-2 py-0.5 text-caption font-semibold ${badgeClass}">${badge}</span>
      </div>
      ${statHtml || ''}
      ${empty
        ? '<p class="text-caption italic text-ink-muted">No candidates for this position.</p>'
        : `<div class="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div class="min-w-0 flex-1 space-y-3 text-ui">${renderResultsCandidateBars(decorated)}</div>
            ${renderResultsDonut(decorated)}
          </div>`}
    </article>
  `;
}

async function fetchRegisteredVoterCount(positionName) {
  if (!positionName) return 0;
  const statsRes = await fetch(
    `${API_BASE_URL}/voting/live-stats?position_name=${encodeURIComponent(positionName)}`
  );
  const stats = await statsRes.json();
  if (!stats.success) return 0;
  return Number(stats.totalVoters) || 0;
}

async function loadResultsDashboard() {
  const container = document.getElementById('resultsDashboard');
  if (!container) return;

  try {
    const [historyRes, activeRes] = await Promise.all([
      fetch(`${API_BASE_URL}/voting/history`),
      fetch(`${API_BASE_URL}/voting/get-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId }),
      }),
    ]);

    const historyData = await historyRes.json();
    const activeData = await activeRes.json();
    const history = historyData.success && Array.isArray(historyData.history) ? historyData.history : [];

    const cards = [];
    let totalVoters = 0;
    let liveStats = null;

    if (activeData.success && activeData.position) {
      const statsRes = await fetch(
        `${API_BASE_URL}/voting/live-stats?position_name=${encodeURIComponent(activeData.position)}`
      );
      liveStats = await statsRes.json();
      if (liveStats.success) {
        totalVoters = Number(liveStats.totalVoters) || 0;
        cards.push(renderResultsCard({
          title: activeData.position,
          badge: 'Live',
          badgeClass: 'bg-accent-soft text-accent',
          isLive: true,
          statHtml: renderLiveStatRow(liveStats.votersWhoVoted, totalVoters),
          candidates: liveStats.candidates,
        }));
      }
    }

    if (totalVoters === 0 && history.length > 0) {
      totalVoters = await fetchRegisteredVoterCount(history[0].name);
    }

    history.forEach((item) => {
      cards.push(renderResultsCard({
        title: item.name,
        badge: item.paper_results_added ? 'Complete · paper added' : 'Complete',
        badgeClass: 'bg-success-soft text-success',
        isLive: false,
        statHtml: renderCompletedStatRow(sumVoteCounts(item.candidates), totalVoters),
        candidates: item.candidates,
      }));
    });

    if (cards.length === 0) {
      container.innerHTML = '<p class="text-center text-ui italic text-ink-muted">No active or completed races yet.</p>';
      return;
    }

    container.innerHTML = cards.join('');
  } catch (err) {
    console.error('Error loading results dashboard:', err);
    container.innerHTML = '<p class="text-center text-ui text-error">Unable to load results.</p>';
  }
}

// ----- Emergency: full election reset -----

const fullResetConfirmInput = document.getElementById('fullResetConfirmInput');
const fullResetBtn = document.getElementById('fullResetBtn');
const fullResetStatus = document.getElementById('fullResetStatus');
const RESET_PHRASE = 'RESET';

function setFullResetStatus(message, kind = 'muted') {
  if (!fullResetStatus) return;
  fullResetStatus.textContent = message;
  fullResetStatus.className =
    kind === 'error'
      ? 'mt-3 text-ui text-error'
      : kind === 'success'
        ? 'mt-3 text-ui text-success'
        : 'mt-3 text-ui text-ink-muted';
}

function syncFullResetButton() {
  if (!fullResetBtn || !fullResetConfirmInput) return;
  fullResetBtn.disabled = fullResetConfirmInput.value !== RESET_PHRASE;
}

if (fullResetConfirmInput && fullResetBtn) {
  fullResetConfirmInput.addEventListener('input', () => {
    syncFullResetButton();
    setFullResetStatus('');
  });

  fullResetBtn.addEventListener('click', async () => {
    if (fullResetConfirmInput.value !== RESET_PHRASE) return;

    fullResetBtn.disabled = true;
    setFullResetStatus('Resetting election…');

    try {
      const res = await apiFetch('/admin/election/full-reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFullResetStatus(data.message || 'Reset failed. No changes were applied.', 'error');
        syncFullResetButton();
        return;
      }

      fullResetConfirmInput.value = '';
      syncFullResetButton();
      setFullResetStatus(
        `Reset complete. ${data.positionsReset} position(s), ${data.candidatesZeroed} candidate(s) zeroed, ${data.votersReset} voter(s) cleared.`,
        'success'
      );

      loadVotingHistory();
      updateToggleVotingButtonState();
      loadActiveVoting();
      if (positionSelect?.value && positionSelect.value !== 'Select') {
        loadLiveVotingStats(positionSelect.value);
      }
      loadResultsDashboard();
      refreshPositionResetCard();
    } catch (err) {
      console.error('Error running full election reset:', err);
      setFullResetStatus('Network error. Reset was not confirmed — check the server before retrying.', 'error');
      syncFullResetButton();
    }
  });
}

// ----- Emergency: single-position reset (active race only) -----

const positionResetIdleMsg = document.getElementById('positionResetIdleMsg');
const positionResetActivePanel = document.getElementById('positionResetActivePanel');
const positionResetConfirmInput = document.getElementById('positionResetConfirmInput');
const positionResetBtn = document.getElementById('positionResetBtn');
const positionResetStatus = document.getElementById('positionResetStatus');
const positionResetScopeNote = document.getElementById('positionResetScopeNote');

let activePositionForReset = null; // { id, name }

function setPositionResetStatus(message, kind = 'muted') {
  if (!positionResetStatus) return;
  positionResetStatus.textContent = message;
  positionResetStatus.className =
    kind === 'error'
      ? 'mt-3 text-ui text-error'
      : kind === 'success'
        ? 'mt-3 text-ui text-success'
        : 'mt-3 text-ui text-ink-muted';
}

function syncPositionResetButton() {
  if (!positionResetBtn || !positionResetConfirmInput) return;
  const armed = Boolean(
    activePositionForReset &&
    positionResetConfirmInput.value === RESET_PHRASE
  );
  positionResetBtn.disabled = !armed;
}

function showPositionResetIdle() {
  activePositionForReset = null;
  if (positionResetIdleMsg) positionResetIdleMsg.classList.remove('hidden');
  if (positionResetActivePanel) positionResetActivePanel.classList.add('hidden');
  if (positionResetConfirmInput) positionResetConfirmInput.value = '';
  if (positionResetBtn) {
    positionResetBtn.textContent = 'Reset current race only';
    positionResetBtn.disabled = true;
  }
}

async function refreshPositionResetCard() {
  if (!positionResetIdleMsg || !positionResetActivePanel) return;

  try {
    const activeRes = await fetch(`${API_BASE_URL}/voting/get-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId }),
    });
    const activeData = await activeRes.json();

    if (!activeData.success || !activeData.position) {
      showPositionResetIdle();
      return;
    }

    const metaRes = await fetch(
      `${API_BASE_URL}/get-position-name?name=${encodeURIComponent(activeData.position)}`
    );
    const meta = await metaRes.json();
    if (!meta.success || !meta.position?.id) {
      showPositionResetIdle();
      return;
    }

    activePositionForReset = { id: meta.position.id, name: meta.position.name };
    positionResetIdleMsg.classList.add('hidden');
    positionResetActivePanel.classList.remove('hidden');

    if (positionResetScopeNote) {
      positionResetScopeNote.textContent =
        `This will reset “${activePositionForReset.name}” only. Other races are not touched.`;
    }
    positionResetBtn.textContent = `Reset ${activePositionForReset.name} only`;
    syncPositionResetButton();
  } catch (err) {
    console.error('Error loading active race for position reset:', err);
    showPositionResetIdle();
  }
}

if (positionResetConfirmInput && positionResetBtn) {
  positionResetConfirmInput.addEventListener('input', () => {
    syncPositionResetButton();
    setPositionResetStatus('');
  });

  positionResetBtn.addEventListener('click', async () => {
    if (!activePositionForReset || positionResetConfirmInput.value !== RESET_PHRASE) return;

    positionResetBtn.disabled = true;
    setPositionResetStatus(`Resetting ${activePositionForReset.name}…`);

    try {
      const res = await apiFetch(`/admin/election/reset-position/${activePositionForReset.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPositionResetStatus(data.message || 'Reset failed. No changes were applied.', 'error');
        syncPositionResetButton();
        refreshPositionResetCard();
        return;
      }

      positionResetConfirmInput.value = '';
      setPositionResetStatus(
        `Reset “${data.positionName}” only. ${data.candidatesZeroed} candidate(s) zeroed, ${data.votersReset} voter(s) cleared. Other races untouched.`,
        'success'
      );

      loadVotingHistory();
      updateToggleVotingButtonState();
      loadActiveVoting();
      if (positionSelect?.value && positionSelect.value !== 'Select') {
        loadLiveVotingStats(positionSelect.value);
      }
      loadResultsDashboard();
      refreshPositionResetCard();
    } catch (err) {
      console.error('Error running single-position reset:', err);
      setPositionResetStatus('Network error. Reset was not confirmed — check the server before retrying.', 'error');
      syncPositionResetButton();
    }
  });
}
