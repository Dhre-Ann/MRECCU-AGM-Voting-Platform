// const API_BASE_URL = process.env.API_BASE_URL;
const API_BASE_URL = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.')
    ? 'http://localhost:3000'
    : 'https://mreccu-agm-voting-platform.onrender.com';

console.log('API Base URL is:', API_BASE_URL);


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
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    value = value.slice(0, 5); // Limit to 5 digits
    e.target.value = value;
  });
}

// verify user
if (voterLoginForm){
  voterLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const phone_number = document.getElementById('phoneNumber').value;
    const account_number = document.getElementById('accountNumber').value;
    console.log("phone: ", phone_number);
    
    // Verify account number not greater than 5 digits
    if (!/^\d{5}$/.test(account_number)) {
      alert("Account number must be exactly 5 digits.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/verify-voter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, account_number }),
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('voterId', data.voterId); // store locally
        window.location.href = './dashboard.html'; // go to next page
      } else {
        alert(data.message || 'Invalid login credentials.');
      }
    } catch (error){
      resultDiv.textContent = 'Error connecting to server';
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


// Toggle voting start and stop
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
      const response = await fetch(`${API_BASE_URL}/voting/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_name: selectedPosition })
      });

      const data = await response.json();

      if (data.success) {
        toggleVotingBtn.textContent = 'Stop Voting';
        votingInactiveMsg.classList.add('hidden');
        votingStatusText.classList.remove('hidden');
        votingStats.classList.remove('hidden');
        loadActiveVoting();
      } else {
        alert(data.message || 'Unable to start voting.');
      }

    } else {
      // Stop voting
      const response = await fetch(`${API_BASE_URL}/voting/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_name: selectedPosition })
      });

      const data = await response.json();

      if (data.success) {
        toggleVotingBtn.textContent = 'Start Voting';
        votingStats.classList.add('hidden');
        votingStatusText.classList.add('hidden');
        votingInactiveMsg.classList.remove('hidden');
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
    const response = await fetch(`${API_BASE_URL}/add-candidate`, {
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
    li.className = 'flex justify-between items-center bg-accent3/10 p-2 rounded';
    
    const span = document.createElement('span');
    span.textContent = `${candidate.name} (${candidate.occupation})`;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'text-red-600 hover:text-red-800';
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
    const response = await fetch(`${API_BASE_URL}/remove-candidate/${candidateId}`, {
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
    // location.reload();
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
      input.className = 'w-24 px-2 py-1 border rounded border-accent4';

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'ml-2 px-2 py-1 text-xs rounded bg-primary text-white';

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
          const response = await fetch(`${API_BASE_URL}/update-votes`, {
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
            setVotesAllowedBtn.style.display = 'inline-block';
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
    toggleVotingBtn.textContent = 'Start Voting';
    votingStats.classList.add('hidden');
    votingInactiveMsg.classList.remove('hidden');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/voting/status?position_name=${encodeURIComponent(positionName)}`);
    const data = await response.json();

    if (data.success) {
      if (data.voting_active) {
        toggleVotingBtn.textContent = 'Stop Voting';
        votingStats.classList.remove('hidden');
        votingInactiveMsg.classList.add('hidden');
        votingStatusText.classList.remove('hidden');
        loadLiveVotingStats(positionName);
        setInterval(() => loadLiveVotingStats(positionName), 3000);
      } else {
        toggleVotingBtn.textContent = 'Start Voting';
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

// Automatically load voting status when position changes
if (positionSelect){
  positionSelect.addEventListener('change', () => {
    const selectedPosition = positionSelect.value;
    loadVotingStatus(selectedPosition);
    loadActiveVoting();
  });
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

async function submitVoteForm(activePosition, hasVoted){
  console.log(activePosition, ', ', hasVoted);

  const selected = Array.from(voteForm.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => parseInt(cb.value));


  if (selected.length === 0) {
    alert('Please select at least one candidate to vote.');
    return;
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

    console.log(voterId, ', ', activePosition );

    const data = await response.json();

    if (data.success) {
      alert('Thank you! Your vote has been recorded.');
      hasVotedFlag = true;
      if (voteForm){
        voteForm.reset(); // optional: clears form
        voteForm.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);
      }      
      await loadActiveVoting();
      await loadLiveVotingStats(activePosition);
    } else {
      // add checks for status 403
      if (response.status === 403) {
      alert(data.message || 'You have already voted for this position.');
      return;
    }
      alert(`Error: ${data.message}`);
    }
  } catch (err) {
    console.error(err);
    alert('An error occurred while submitting your vote.');
  }
}

async function loadActiveVoting() {
  console.log("run voting acting");
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
        votingStatusMsg.textContent = 'Voting will begin soon. Please stay tuned for further instructions.';
      }
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
      label.className = 'flex items-start p-4 bg-white rounded-xl shadow hover:shadow-lg transition cursor-pointer space-x-4';
      label.innerHTML = `
        <input type="checkbox" name="${position}" value="${candidate.id}" class="mt-1 accent-accent4" />
        <div class="text-left pl-2">
          <p class="font-semibold text-primary">${candidate.name}</p>
          <p class="text-sm text-accent2 italic">${candidate.occupation}</p>
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
    console.log('flag check', hasVotedFlag);

    if (votingStatusMsg && votingSection){
      votingStatusMsg.classList.add('hidden');
      votingSection.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
    if (votingStatusMsg){
      votingStatusMsg.textContent = 'Error loading voting configuration.';
    }
  }
}

// Function to load Voting History
async function loadVotingHistory() {
  console.log('load voting history called');
  const historyList = document.getElementById('votingHistoryList'); // You need to add this id to <ul>

  if (historyList){
    historyList.innerHTML = ''; // Clear previous

    try {
      const res = await fetch(`${API_BASE_URL}/voting/history`);
      const data = await res.json();

      if (data.success && data.history.length > 0) {
        data.history.forEach(item => {
          const li = document.createElement('li');
          li.className = 'bg-white p-3 rounded-md shadow';
          li.innerHTML = `
            <strong>${item.name}</strong><br/>
            Status: ${item.voting_complete ? 'Closed' : 'Open'}
          `;
          historyList.appendChild(li);
        });
      } else {
        historyList.innerHTML = '<li class="text-center text-accent2 italic"> No completed voting sessions yet.</li>';
      }
    
    } catch (err) {
      console.error(err);
      historyList.innerHTML = '<li>Error loading voting history.</li>';
    }
  }
}

async function loadLiveVotingStats(positionName) {
  console.log('live voting stats called');

  if (!positionName || positionName === 'null') {
    console.warn('No position name passed to live stats');
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
    progressBar.style.width = `${percent}%`;

    // ✅ Show number of voters who have voted
    document.getElementById('votesCount').textContent = data.votersWhoVoted;
    document.getElementById('votesTotal').textContent = data.totalVoters;

    // Update candidate votes breakdown
    const candidateVotes = document.getElementById('candidateVotes');
    candidateVotes.innerHTML = '';

    data.candidates.forEach(candidate => {
      const div = document.createElement('div');
      div.className = 'flex justify-between';
      div.innerHTML = `
        <span>${candidate.name}</span>
        <span class="font-semibold text-primary">${candidate.vote_count} votes</span>
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

  // clearInterval();
  // setInterval(() => {
  //   loadActiveVoting(); // Run repeatedly every X seconds
  // }, 10000); // Example: every 10 seconds

  // setInterval(loadActiveVoting, 10000);
});

// Event listener to allow voting
if (voteForm && submitVoteBtn){
  voteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitVoteForm(positionForVote, hasVotedFlag);
  });
}





// add voter - STANDALONE TEST - WILL BE NEEDED LATER FOR ADMIN
// document.addEventListener('DOMContentLoaded', () => {
//     const form = document.getElementById('voterForm');
//     const resultDiv = document.getElementById('result');
  
//     if (form)
//       form.addEventListener('submit', async (e) => {
//         e.preventDefault();
    
//         const phone_number = document.getElementById('phoneNumber').value;
//         const account_number = document.getElementById('accountNumber').value;
    
//         try {
//           const response = await fetch('${API_BASE_URL}/add-voter', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ phone_number, account_number }),
//           });
    
//           const data = await response.json();
    
//           if (data.success) {
//             resultDiv.textContent = `Voter added with ID ${data.voter.id}`;
//           } else {
//             resultDiv.textContent = 'Failed to add voter: ' + (data.error || 'Unknown error');
//           }
//         } catch (error) {
//           resultDiv.textContent = 'Error connecting to server';
//         }
//       });
//   });
