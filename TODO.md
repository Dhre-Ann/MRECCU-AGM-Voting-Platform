# ✅ Election App Development Tracker

This file tracks tasks, progress, and future improvements for the live election web app.

---

## 🔮 **Future Enhancements (Pending June 2026)**
- [ ] Export election results as CSV  
- [ ] Add admin dashboard for vote monitoring  
- [ ] Improve UI with animations  
- [ ] Implement OTP-based secure login
- [ ] Implement "guest user" on new super login (for members without phones/devices)
- [ ] Advance securities on application to allow for orgnaizational adoption

---

## 🏗️ **Project Setup**
- [x] Set up GitHub repository  
- [X] Initialize Node.js project (`npm init -y`)  
- [X] Install dependencies (`express`, `pg`, `dotenv`, `cors`, `npm-run-all --save-dev` etc.)  
- [X] Set up project folder structure  
- [X] Set up webpack for js bundling 
- [X] Set up tailwind

---

## 🔧 **Backend Development**
### **Authentication**
- [X] Create PostgreSQL database (`election_db`)  
- [X] Define `Users` table (name, phone number)  
- [X] Implement simple phone-based login  
- [X] Add real-time session tracking  

### **Nominations & Voting**
- [X] Define `Nominees` table  
- [X] Create API endpoint for staff to add nominees  
- [X] Implement WebSocket for real-time updates  
- [X] Validate vote selections (max allowed per position)  
- [X] Store votes securely in `Votes` table  

---

## 🎨 **Frontend Development**
### **Login Page**
- [X] Create login form (name + phone number)  
- [X] Connect login to backend authentication  
- [X] Display user-friendly errors on failed login  

### **Voting Page**
- [X] Design live-updating nominee list  
- [X] Allow users to vote via checkbox selection  
- [X] Submit votes & display confirmation  

### **Admin/Staff View**
- [X] Create nomination form  
- [X] Enable live nominee updates across devices  
- [X] Display vote counts in real-time  

---

## 🚀 **Deployment & Optimization**
- [X] Set up local hosting on staff laptop  
- [X] Generate QR codes for easy voting access  
- [X] Optimize Webpack bundling (if used)  
- [X] Test across different devices (mobile, desktop)  


