# Contacts VCF Manager

אפליקציית React + TypeScript לניהול אנשי קשר מקובץ טלפון, עם עבודה מקומית בלבד.

## קישורים מהירים

- אתר האפליקציה: https://dani860.github.io/oneroster/
- עמוד הפרויקט ב-GitHub: https://github.com/dani860/oneroster
- עמוד Releases להורדת גרסאות: https://github.com/dani860/oneroster/releases

## יכולות עיקריות

- טעינת קובץ VCF מהמחשב.
- תצוגת אנשי קשר בכרטיסיות נפרדות.
- עריכה של שם פרטי, שם משפחה, טלפונים ומיילים.
- חיפוש חופשי לפי שם, טלפון או מייל.
- מיון לפי שם, טלפון, קידומת, מספר מיילים ותאריך עדכון.
- זיהוי כפולים לפי שם/מספר זהים ודמיון בשם/מספר.
- ייצוא לקבצים: VCF, CSV, XLSX.

## התקנה והרצה

```bash
npm install
npm run dev
```

האפליקציה תעלה בכתובת שמופיעה בטרמינל (בדרך כלל http://localhost:5173).

## Build לפרודקשן

```bash
npm run build
npm run preview
```

## אפליקציית Windows להפצה

האפליקציה מוגדרת גם כ-Desktop עם Electron. כרגע ההפצה הרשמית היא בגרסה ניידת בלבד.

### הרצה מקומית כאפליקציית Desktop

```bash
npm run desktop:dev
```

### יצירת קובץ הפצה ל-Windows

```bash
npm run desktop:build
```

אחרי סיום התהליך תמצא את קובץ ההפצה בתיקייה `release`:

- `OneRoster-Portable-<version>-x64.exe` - גרסה ניידת ללא התקנה

## הערות

- העבודה מתבצעת מקומית בדפדפן, בלי שרת צד-שרת.
- ייצוא Excel משתמש בספריית xlsx.
