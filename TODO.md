# ✅ Election App Development Tracker

This file tracks tasks, progress, and future improvements for the live election web app.

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
- [ ] Create PostgreSQL database (`election_db`)  
- [ ] Define `Users` table (name, phone number)  
- [ ] Implement simple phone-based login  
- [ ] Add real-time session tracking  

### **Nominations & Voting**
- [ ] Define `Nominees` table  
- [ ] Create API endpoint for staff to add nominees  
- [ ] Implement WebSocket for real-time updates  
- [ ] Validate vote selections (max allowed per position)  
- [ ] Store votes securely in `Votes` table  

---

## 🎨 **Frontend Development**
### **Login Page**
- [ ] Create login form (name + phone number)  
- [ ] Connect login to backend authentication  
- [ ] Display user-friendly errors on failed login  

### **Voting Page**
- [ ] Design live-updating nominee list  
- [ ] Allow users to vote via checkbox selection  
- [ ] Submit votes & display confirmation  

### **Admin/Staff View**
- [ ] Create nomination form  
- [ ] Enable live nominee updates across devices  
- [ ] Display vote counts in real-time  

---

## 🚀 **Deployment & Optimization**
- [ ] Set up local hosting on staff laptop  
- [ ] Generate QR codes for easy voting access  
- [ ] Optimize Webpack bundling (if used)  
- [ ] Test across different devices (mobile, desktop)  

---

## 🔮 **Future Enhancements**
- [ ] Export election results as CSV  
- [ ] Add admin dashboard for vote monitoring  
- [ ] Improve UI with animations  
- [ ] Implement OTP-based secure login (optional)  

---

## 📅 **Progress Updates**
_(Log key milestones here)_
- **[dd/mm]** - Completed backend login logic  
- **[dd/mm]** - Basic nominee submission working  
- **[dd/mm]** - Voting system implemented 🎉  

---

### 🔥 **Next Steps**
- Finish real-time nominee updates  
- Implement voting selection validation  
- Test with a small group before live election  

