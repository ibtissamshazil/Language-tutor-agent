import { Router, type IRouter } from "express";

const router: IRouter = Router();

type Phrase = { urdu: string; transliteration: string; english: string };
type Lesson = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  phrases: Phrase[];
};

const LESSONS: Lesson[] = [
  {
    slug: "greetings",
    title: "Greetings & Courtesy",
    description: "The first words to greet people warmly and be polite in Urdu.",
    emoji: "hand",
    phrases: [
      { urdu: "السلام علیکم", transliteration: "assalaam-o-alaikum", english: "Peace be upon you (hello)" },
      { urdu: "وعلیکم السلام", transliteration: "wa-alaikum-assalaam", english: "And peace be upon you too (reply)" },
      { urdu: "آداب", transliteration: "aadaab", english: "Respectful greeting / hello" },
      { urdu: "شکریہ", transliteration: "shukriya", english: "Thank you" },
      { urdu: "معاف کیجیے", transliteration: "maaf kijiye", english: "Excuse me / sorry" },
      { urdu: "خدا حافظ", transliteration: "khuda haafiz", english: "Goodbye" },
    ],
  },
  {
    slug: "introductions",
    title: "Introducing Yourself",
    description: "Say your name, ask someone's name, and exchange basic pleasantries.",
    emoji: "person",
    phrases: [
      { urdu: "میرا نام ۔۔۔ ہے", transliteration: "mera naam ... hai", english: "My name is ..." },
      { urdu: "آپ کا نام کیا ہے؟", transliteration: "aap ka naam kya hai?", english: "What is your name?" },
      { urdu: "آپ کیسے ہیں؟", transliteration: "aap kaise hain?", english: "How are you?" },
      { urdu: "میں ٹھیک ہوں", transliteration: "main theek hoon", english: "I am fine" },
      { urdu: "آپ سے مل کر خوشی ہوئی", transliteration: "aap se mil kar khushi hui", english: "Nice to meet you" },
    ],
  },
  {
    slug: "numbers",
    title: "Numbers 1 to 10",
    description: "Count from one to ten in Urdu.",
    emoji: "numbers",
    phrases: [
      { urdu: "ایک", transliteration: "aik", english: "One (1)" },
      { urdu: "دو", transliteration: "do", english: "Two (2)" },
      { urdu: "تین", transliteration: "teen", english: "Three (3)" },
      { urdu: "چار", transliteration: "chaar", english: "Four (4)" },
      { urdu: "پانچ", transliteration: "paanch", english: "Five (5)" },
      { urdu: "چھ", transliteration: "chhe", english: "Six (6)" },
      { urdu: "سات", transliteration: "saat", english: "Seven (7)" },
      { urdu: "آٹھ", transliteration: "aath", english: "Eight (8)" },
      { urdu: "نو", transliteration: "nau", english: "Nine (9)" },
      { urdu: "دس", transliteration: "das", english: "Ten (10)" },
    ],
  },
  {
    slug: "common-words",
    title: "Everyday Words",
    description: "High-frequency words you will use in almost every conversation.",
    emoji: "chat",
    phrases: [
      { urdu: "ہاں", transliteration: "haan", english: "Yes" },
      { urdu: "نہیں", transliteration: "nahin", english: "No" },
      { urdu: "پانی", transliteration: "paani", english: "Water" },
      { urdu: "کھانا", transliteration: "khaana", english: "Food / meal" },
      { urdu: "اچھا", transliteration: "achha", english: "Good / okay" },
      { urdu: "بڑا", transliteration: "bara", english: "Big" },
      { urdu: "چھوٹا", transliteration: "chhota", english: "Small" },
      { urdu: "دوست", transliteration: "dost", english: "Friend" },
    ],
  },
  {
    slug: "useful-phrases",
    title: "Useful Phrases",
    description: "Short sentences to help you get by in real situations.",
    emoji: "phrase",
    phrases: [
      { urdu: "یہ کیا ہے؟", transliteration: "ye kya hai?", english: "What is this?" },
      { urdu: "کتنے کا ہے؟", transliteration: "kitne ka hai?", english: "How much is it?" },
      { urdu: "مجھے سمجھ نہیں آئی", transliteration: "mujhe samajh nahin aayi", english: "I did not understand" },
      { urdu: "براہِ کرم آہستہ بولیں", transliteration: "baraah-e-karam aahista bolein", english: "Please speak slowly" },
      { urdu: "مدد چاہیے", transliteration: "madad chahiye", english: "I need help" },
    ],
  },
  {
    slug: "days-time",
    title: "Days & Time",
    description: "Talk about days of the week and times of day.",
    emoji: "clock",
    phrases: [
      { urdu: "آج", transliteration: "aaj", english: "Today" },
      { urdu: "کل", transliteration: "kal", english: "Tomorrow / yesterday" },
      { urdu: "صبح", transliteration: "subah", english: "Morning" },
      { urdu: "شام", transliteration: "shaam", english: "Evening" },
      { urdu: "رات", transliteration: "raat", english: "Night" },
      { urdu: "ہفتہ", transliteration: "hafta", english: "Week / Saturday" },
    ],
  },
];

router.get("/lessons", (_req, res) => {
  res.json(LESSONS);
});

router.get("/lessons/:slug", (req, res) => {
  const lesson = LESSONS.find((l) => l.slug === req.params.slug);
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  res.json(lesson);
});

export default router;
