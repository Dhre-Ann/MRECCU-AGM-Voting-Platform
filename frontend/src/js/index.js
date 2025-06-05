// login button
var loginRedirect = document.getElementById("login-redirect-btn");
if (loginRedirect) {
  loginRedirect.addEventListener("click", () => {
    window.location.href = "./pages/login.html";
  });
}

// verify user



// add voter
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('voterForm');
    const resultDiv = document.getElementById('result');
  
    if (form)
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
    
        const phone_number = document.getElementById('phoneNumber').value;
        const account_number = document.getElementById('accountNumber').value;
    
        try {
          const response = await fetch('http://localhost:3000/add-voter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number, account_number }),
          });
    
          const data = await response.json();
    
          if (data.success) {
            resultDiv.textContent = `Voter added with ID ${data.voter.id}`;
          } else {
            resultDiv.textContent = 'Failed to add voter: ' + (data.error || 'Unknown error');
          }
        } catch (error) {
          resultDiv.textContent = 'Error connecting to server';
        }
      });
  });
