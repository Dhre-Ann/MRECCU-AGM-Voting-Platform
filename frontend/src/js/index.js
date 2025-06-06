// Variables
const loginRedirect = document.getElementById("login-redirect-btn");
const phoneInput = document.getElementById('phoneNumber');
const accountInput = document.getElementById('accountNumber');
const voterLoginForm = document.getElementById('voterForm');
const resultDiv = document.getElementById('result');

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
      const response = await fetch('http://localhost:3000/verify-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, account_number }),
      });

      const data = await response.json();
      if (data.success) {
        window.location.href = './dashboard.html'; // go to next page
      } else {
        alert(data.message || 'Invalid login credentials.');
      }
    } catch (error){
      resultDiv.textContent = 'Error connecting to server';
    }
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
//           const response = await fetch('http://localhost:3000/add-voter', {
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
