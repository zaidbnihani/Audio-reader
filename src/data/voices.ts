import { VoiceOption } from '../types';

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'neutral',
    tone: 'Natural & Balanced',
    toneAr: 'طبيعي ومتوازن',
    description: 'Crisp and expressive voice suitable for all general text.',
    descriptionAr: 'صوت واضح ومعبر ومناسب لجميع النصوص العامة والمحادثات.',
  },
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    tone: 'Warm & Articulate',
    toneAr: 'دافئ وواضح النطق',
    description: 'Polished and welcoming voice with clear diction.',
    descriptionAr: 'نبرة صوتية مريحة وواضحة جداً مثالية للشروحات والقراءة.',
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    tone: 'Energetic & Dynamic',
    toneAr: 'حيوي ونشيط',
    description: 'Engaging, upbeat tone for storytelling and casual audio.',
    descriptionAr: 'صوت مفعم بالحيوية والحماس، رائع للقصص والمحتوى التفاعلي.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    tone: 'Deep & Resonant',
    toneAr: 'عميق وفخم',
    description: 'Deep authoritative voice great for narrations and podcasts.',
    descriptionAr: 'نبرة عميقة وفخمة تناسب الوثائقيات والبودكاست والإعلانات.',
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    tone: 'Calm & Steady',
    toneAr: 'هادئ ورصين',
    description: 'Measured, serious tone ideal for technical and academic reads.',
    descriptionAr: 'صوت هادئ ورزين مناسب للمقالات الإخبارية والنصوص التعليمية.',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    tone: 'Gentle & Melodic',
    toneAr: 'عذب ورقيق',
    description: 'Smooth and soft tone with soothing resonance.',
    descriptionAr: 'صوت رقيق وهادئ يضفي لمسة سلسة وجميلة على النص.',
  },
];

export const SAMPLE_TEXTS = [
  {
    label: 'مرحبا بالعالم',
    text: 'مرحباً بكم في استوديو تحويل النص إلى صوت بالذكاء الاصطناعي. يمكنكم تحويل أي نص إلى كلام واقعي وفائق الدقة بضغطة زر واحدة.',
    lang: 'ar',
  },
  {
    label: 'اقتباس تحفيزي',
    text: 'إن النجاح لا يأتي بالصدفة، بل هو ثمرة العمل الجاد والمثابرة والتعلم المستمر من الأخطاء والتجارب.',
    lang: 'ar',
  },
  {
    label: 'نص إخباري',
    text: 'أعلنت مراكز الأبحاث اليوم عن تقدم نوعي في تقنيات معالجة اللغات الطبيعية وتوليد الأصوات البشرية بدقة غير مسبوقة.',
    lang: 'ar',
  },
  {
    label: 'Welcome (EN)',
    text: 'Welcome to the Text to Speech Studio powered by Gemini. Experience lifelike, crystal-clear voice synthesis in seconds.',
    lang: 'en',
  },
];
