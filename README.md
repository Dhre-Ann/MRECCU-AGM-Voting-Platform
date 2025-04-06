# MRECCU-AGM-Voting-Platform
Mon Repos Eastern Co-operative Credit Union (MRECCU) AGM Live Elections App

This is a web application for MRECCU. 
  * Members register with their phone numbers and account number
    - Username: phone number
    - Password: Account number
  * Members nominate live and admin will populate nominees
  * Members enter an number specified by admin to authenticate before voting
  * Members vote in real-time 

  * All voting happens via personal cell phones while connected to an network.
  * People without devices will vote on paper and tallies will be added after.

# Core Features
  - Phone number + account numebr based authentication
  - Live nominations and voting
  - Real time updates and futher authentication controlled by staff
  - Mobile friendly UI with QR code access

# Tech Stack
  ### Backend
  - Node.js
  - Express.js
  - PostgreSQL
  
  ### Frontend
  - HTML
  - Tailwind (CSS)
  - Webpack
  
  ### Hosting
  - AWS server (TBD)
  - Github for version control

#Installation
1. **Clone the repository**
     https://github.com/Dhre-Ann/MRECCU-AGM-Voting-Platform
2. **Install dependencies**
     npm init -y (initialze Node js)
     npm install express pg dotenv
     npm install --save-dev webpack webpack-cli
     npm install -D tailwindcss@3
     npx tailwindcss init
     npx update-browserslist-db@latest  //update browser list
3. **Set up database**
     
4. Start server
5. Open http://localhost:3000 in browser (or whatever port you use)

# Project Structure
  - backend
  - frontend
    - assets (images)
    - dist (js bundle)
    - pages (html files)
    - src
      - js files
      - css files
    - index.html
  - node modules (npm dependencies)
  - gitignore file
  - package.json file
  - package.json lock file
  - Readme.md
  - Todo.md
  - tailwind.config.js (tailwind configuration)
  - webpack.config.js (webpack configuration for bundling js files)

# Future Improvements
- Admin dashboard for viewing results
  - Append manually collected votes (input section to add votes from paper)
- Graphical representation of results (showing stats from devices, and devices and paper combined)
