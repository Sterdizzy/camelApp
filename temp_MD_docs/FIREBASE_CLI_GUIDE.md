# Firebase CLI Quick Start Guide

## ✅ **Firebase CLI is Already Installed!**
Version: `14.12.1`

## **🚀 Quick Start Commands**

### **1. Login to Firebase**
```bash
npm run firebase:login
# or directly:
firebase login
```

### **2. List Your Firebase Projects**
```bash
firebase projects:list
```

### **3. Initialize Firebase in Your Project**
```bash
npm run firebase:init
# or directly:
firebase init
```
**Select:**
- ☑️ Firestore (Database rules and indexes)
- ☑️ Hosting (Configure files for Firebase Hosting)
- ☑️ Functions (Optional - for Cloud Functions)

### **4. Deploy Everything**
```bash
npm run firebase:deploy
# or directly:
firebase deploy
```

### **5. Deploy Only Website**
```bash
npm run firebase:deploy:hosting
```

### **6. Deploy Only Firestore Rules**
```bash
npm run firebase:deploy:firestore
```

---

## **🛠️ Development Commands**

### **Start Local Emulators**
```bash
npm run firebase:emulators
# Access at: http://localhost:4000 (Emulator UI)
```

### **Serve Built Website Locally**
```bash
npm run firebase:serve
# Access at: http://localhost:5000
```

---

## **📋 Step-by-Step Deployment Process**

### **Step 1: Create Firebase Project**
1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Enter name: `camelApp`
4. Note your **Project ID**

### **Step 2: Login & Initialize**
```bash
# Login to Firebase
npm run firebase:login

# Initialize project
npm run firebase:init

# When prompted, select:
# - Use existing project: your-project-id
# - Firestore rules file: firestore.rules (already exists)
# - Firestore indexes: firestore.indexes.json (already exists)
# - Public directory: dist
# - Single-page app: Yes
# - GitHub integration: Optional
```

### **Step 3: Deploy**
```bash
# Build and deploy everything
npm run firebase:deploy
```

---

## **🔧 Firebase Configuration Files**

Your project now includes:

### **`firebase.json`** ✅
- **Firestore**: Rules and indexes configuration
- **Hosting**: Website deployment settings
- **Functions**: Cloud Functions setup (optional)
- **Emulators**: Local development settings

### **`firestore.rules`** ✅
- Security rules for user data isolation
- Production-ready permission system

### **`firestore.indexes.json`** ✅
- Database indexes for optimal query performance
- Supports complex filtering and sorting

---

## **🚀 Deployment Options**

### **Option A: Firebase Hosting (Recommended)**
✅ **Already Configured!**
- Global CDN
- Automatic HTTPS
- Easy custom domains
- Built-in rollbacks

```bash
npm run firebase:deploy:hosting
```

### **Option B: Vercel (Alternative)**
1. Connect GitHub repo to Vercel
2. Set environment variables
3. Deploy automatically on push

### **Option C: Cloudflare Pages**
1. Connect GitHub repo to Cloudflare Pages  
2. Build command: `npm run build`
3. Output directory: `dist`

---

## **📊 Firebase Console URLs**

After deployment, access:
- **Firebase Console**: https://console.firebase.google.com/project/YOUR_PROJECT_ID
- **Firestore Database**: Console > Firestore Database
- **Authentication**: Console > Authentication
- **Hosting**: Console > Hosting
- **Your Live Website**: https://YOUR_PROJECT_ID.web.app

---

## **🔍 Useful Commands**

### **Project Management**
```bash
firebase use --add                 # Add project alias
firebase use production            # Switch to production project
firebase list                     # List all projects
```

### **Database Operations**
```bash
firebase firestore:indexes        # List database indexes
firebase firestore:delete --recursive /users  # Delete collection (careful!)
```

### **Hosting**
```bash
firebase hosting:sites:list       # List hosting sites
firebase hosting:clone SOURCE DEST # Clone site
```

### **Logs & Monitoring**
```bash
firebase functions:log            # View function logs
firebase hosting:channel:list     # List preview channels
```

---

## **🚨 Important Notes**

1. **Never commit `.env` file** - Contains sensitive keys
2. **Test with emulators first** - `npm run firebase:emulators`
3. **Deploy Firestore rules carefully** - Wrong rules can break app
4. **Monitor usage** - Firebase has generous free tiers but can incur costs
5. **Set up billing alerts** - Avoid unexpected charges

---

## **🆘 Troubleshooting**

### **"Permission denied" errors**
```bash
firebase login --reauth  # Re-authenticate
```

### **"Project not found"**
```bash
firebase use --add  # Add project to local config
```

### **Build fails**
```bash
npm run build  # Test build locally first
```

### **Emulators won't start**
```bash
firebase emulators:exec --only firestore "npm run dev"
```

---

## **🎯 Next Steps**

1. **Run `firebase login`** to authenticate
2. **Create your Firebase project** in the console
3. **Run `firebase init`** to initialize
4. **Deploy with `npm run firebase:deploy`**
5. **Celebrate!** 🎉

Your InvestSavvy app will be live on Firebase Hosting with:
- ✅ Global CDN delivery
- ✅ Automatic HTTPS 
- ✅ Custom domain support
- ✅ Easy rollbacks and previews