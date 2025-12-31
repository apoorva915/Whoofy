// Service for analyzing sentiment from transcript and captions
// Detects positive/neutral/negative sentiment about brands using rule-based analysis

import logger from '@/utils/logger';

/**
 * Sentiment type
 */
export type Sentiment = 'positive' | 'negative' | 'neutral';

/**
 * Comprehensive positive sentiment keywords
 */
const POSITIVE_WORDS = [
  // General positive
  'love', 'amazing', 'best', 'great', 'awesome', 'excellent', 'fantastic', 'wonderful',
  'perfect', 'brilliant', 'outstanding', 'superb', 'incredible', 'fabulous', 'marvelous',
  'phenomenal', 'exceptional', 'remarkable', 'splendid', 'magnificent', 'terrific',
  'good', 'nice', 'fine', 'well', 'well-done', 'well done',
  
  // Enjoyment & satisfaction
  'enjoy', 'enjoyed', 'enjoying', 'pleased', 'satisfied', 'happy', 'delighted', 'thrilled',
  'ecstatic', 'overjoyed', 'content', 'fulfilled', 'grateful', 'appreciate', 'appreciated',
  
  // Recommendation & approval
  'recommend', 'recommended', 'recommending', 'suggest', 'suggested', 'approve', 'approved',
  'endorse', 'endorsed', 'support', 'supported', 'back', 'backed', 'favorite', 'favourite',
  'prefer', 'preferred', 'choose', 'chose', 'chosen', 'pick', 'picked',
  
  // Quality & taste (for products)
  'tasty', 'delicious', 'yummy', 'scrumptious', 'delectable', 'flavorful', 'flavourful',
  'savory', 'savoury', 'mouthwatering', 'appetizing', 'appetising', 'succulent', 'juicy',
  'fresh', 'quality', 'premium', 'high-quality', 'top-notch', 'first-class', 'superior',
  'refined', 'sophisticated', 'luxury', 'luxurious', 'premium', 'premium-quality',
  'sweet', 'sweetness', 'soft', 'smooth', 'creamy', 'rich', 'flavorful', 'flavourful',
  
  // Performance & effectiveness
  'effective', 'efficient', 'powerful', 'strong', 'robust', 'reliable', 'dependable',
  'durable', 'long-lasting', 'sturdy', 'solid', 'well-made', 'well-built', 'crafted',
  
  // Value & worth
  'worth', 'worthwhile', 'valuable', 'priceless', 'treasure', 'gem', 'find', 'deal',
  'bargain', 'steal', 'affordable', 'reasonable', 'fair', 'good value', 'value for money',
  
  // Success & achievement
  'success', 'successful', 'achieve', 'achieved', 'accomplish', 'accomplished', 'win',
  'won', 'victory', 'triumph', 'breakthrough', 'milestone',
  
  // Improvement & growth
  'improve', 'improved', 'improving', 'better', 'best', 'enhance', 'enhanced', 'upgrade',
  'upgraded', 'boost', 'boosted', 'increase', 'increased', 'grow', 'grew', 'grown',
  
  // Trust & confidence
  'trust', 'trusted', 'trustworthy', 'reliable', 'dependable', 'confident', 'confidence',
  'believe', 'believed', 'faith', 'faithful', 'loyal', 'loyalty',
  
  // Excitement & enthusiasm
  'excited', 'exciting', 'thrilled', 'thrilling', 'pumped', 'hyped', 'energized',
  'motivated', 'inspired', 'inspiring', 'uplifting', 'encouraging', 'encouraged',
  
  // Beauty & aesthetics
  'beautiful', 'gorgeous', 'stunning', 'striking', 'attractive', 'appealing', 'charming',
  'elegant', 'graceful', 'stylish', 'fashionable', 'trendy', 'modern', 'contemporary',
  'bright', 'brightening', 'brightened', 'brightness', 'glowing', 'glow', 'radiant', 'radiance',
  'awake', 'awaken', 'awakening', 'refreshed', 'refreshing', 'revitalized', 'revitalizing',
  
  // Transformation & improvement
  'transform', 'transformation', 'transforming', 'transformed', 'change', 'changed', 'changing',
  'improve', 'improved', 'improving', 'enhance', 'enhanced', 'enhancing', 'upgrade', 'upgraded',
  'boost', 'boosted', 'boosting', 'lift', 'lifted', 'lifting',
  
  // Tips & recommendations
  'hack', 'hacks', 'tip', 'tips', 'trick', 'tricks', 'secret', 'secrets', 'must-have', 'must have',
  'game-changer', 'game changer', 'life-saver', 'life saver', 'essential', 'essentials',
  
  // Value & deals
  'discounted', 'discount', 'sale', 'deal', 'deals', 'bargain', 'bargains', 'affordable',
  'worth', 'worthwhile', 'valuable', 'value', 'priceless', 'treasure', 'gem', 'find',
  
  // Immediate results
  'immediately', 'immediate', 'instant', 'instantly', 'quick', 'quickly', 'fast', 'fast-acting',
  'rapid', 'rapidly', 'right away', 'straight away',
  
  // Comfort & ease
  'comfortable', 'comfort', 'cozy', 'cosy', 'relaxing', 'relaxed', 'peaceful', 'calm',
  'easy', 'easier', 'easiest', 'simple', 'simpler', 'simplest', 'convenient', 'handy',
  'effortless', 'effortlessly', 'no makeup', 'no-makeup', 'makeup-free', 'makeup free',
  
  // Health & wellness
  'healthy', 'healthier', 'nutritious', 'nutritive', 'wholesome', 'beneficial', 'good for',
  'safe', 'safer', 'safest', 'clean', 'cleaner', 'pure', 'purer', 'natural', 'organic',
];

/**
 * Comprehensive negative sentiment keywords
 */
const NEGATIVE_WORDS = [
  // General negative
  'hate', 'hated', 'hating', 'bad', 'worst', 'awful', 'terrible', 'horrible', 'dreadful',
  'atrocious', 'appalling', 'disgusting', 'revolting', 'repulsive', 'repugnant', 'vile',
  'nasty', 'ugly', 'hideous', 'gross', 'yuck', 'yucky', 'ew', 'eww',
  
  // Disappointment & dissatisfaction
  'disappoint', 'disappointed', 'disappointing', 'disappointment', 'let down', 'letdown',
  'dissatisfied', 'unsatisfied', 'unhappy', 'sad', 'saddened', 'upset', 'upsetting',
  'frustrated', 'frustrating', 'annoyed', 'annoying', 'irritated', 'irritating',
  
  // Disapproval & rejection
  'dislike', 'disliked', 'reject', 'rejected', 'refuse', 'refused', 'decline', 'declined',
  'avoid', 'avoided', 'skip', 'skipped', 'pass', 'passed', 'dismiss', 'dismissed',
  
  // Quality issues
  'poor', 'poorer', 'poorest', 'cheap', 'cheaper', 'cheapest', 'low-quality', 'low quality',
  'inferior', 'substandard', 'shoddy', 'flimsy', 'weak', 'weaker', 'weakest', 'fragile',
  'brittle', 'breakable', 'unreliable', 'undependable', 'unstable', 'unsteady',
  
  // Taste & quality (for products)
  'bland', 'tasteless', 'flavorless', 'flavourless', 'boring', 'uninteresting', 'dull',
  'stale', 'rotten', 'spoiled', 'spoilt', 'expired', 'off', 'rancid', 'sour', 'bitter',
  'burnt', 'overcooked', 'undercooked', 'raw', 'tough', 'rubbery', 'dry', 'dryer',
  
  // Problems & issues
  'problem', 'problems', 'issue', 'issues', 'trouble', 'troubles', 'difficulty', 'difficulties',
  'challenge', 'challenges', 'obstacle', 'obstacles', 'barrier', 'barriers', 'hurdle', 'hurdles',
  'defect', 'defects', 'flaw', 'flaws', 'fault', 'faults', 'error', 'errors', 'mistake', 'mistakes',
  'bug', 'bugs', 'glitch', 'glitches', 'malfunction', 'malfunctions', 'breakdown', 'breakdowns',
  
  // Failure & underperformance
  'fail', 'failed', 'failing', 'failure', 'failures', 'unsuccessful', 'unsuccess',
  'lose', 'lost', 'losing', 'loss', 'losses', 'defeat', 'defeated', 'beaten',
  'underperform', 'underperformed', 'underperforming', 'underperformance',
  
  // Waste & regret
  'waste', 'wasted', 'wasting', 'wasteful', 'regret', 'regretted', 'regretting', 'regretful',
  'sorry', 'apologize', 'apologized', 'apologizing', 'apology',
  
  // Deception & dishonesty
  'fake', 'faked', 'faking', 'fraud', 'fraudulent', 'scam', 'scammed', 'scamming', 'scammer',
  'deceive', 'deceived', 'deceiving', 'deceptive', 'deception', 'mislead', 'misled',
  'misleading', 'dishonest', 'dishonesty', 'lie', 'lied', 'lying', 'false', 'falsified',
  'counterfeit', 'imitation', 'copy', 'copied', 'knockoff', 'rip-off', 'ripoff',
  
  // Overpricing & value issues
  'overpriced', 'over-price', 'expensive', 'costly', 'pricey', 'unaffordable', 'unreasonable',
  'rip-off', 'ripoff', 'scam', 'waste of money', 'not worth', 'not worth it', 'poor value',
  'bad value', 'overcharge', 'overcharged', 'overcharging',
  
  // Health & safety concerns
  'unhealthy', 'harmful', 'dangerous', 'unsafe', 'risky', 'hazardous', 'toxic', 'poisonous',
  'contaminated', 'polluted', 'dirty', 'filthy', 'unclean', 'unsanitary', 'unhygienic',
  
  // Discomfort & difficulty
  'uncomfortable', 'discomfort', 'painful', 'pain', 'hurt', 'hurting', 'sore', 'aching',
  'difficult', 'hard', 'harder', 'hardest', 'challenging', 'complicated', 'complex',
  'confusing', 'confused', 'frustrating', 'frustrated', 'annoying', 'annoyed',
  
  // Boredom & disinterest
  'boring', 'bored', 'dull', 'tedious', 'monotonous', 'repetitive', 'uninteresting',
  'uninspiring', 'unmotivating', 'unexciting', 'lifeless', 'dead', 'flat',
  
  // Ineffectiveness
  'ineffective', 'inefficient', 'useless', 'pointless', 'futile', 'vain', 'worthless',
  'ineffective', 'doesn\'t work', "doesn't work", 'not working', 'broken', 'broken down',
  
  // Regret & disappointment
  'wish', 'wished', 'wishing', "didn't buy", "don't buy", "won't buy", 'shouldn\'t have',
  "shouldn't have", 'waste of time', 'waste of money', 'not recommended', "don't recommend",
  "wouldn't recommend", "can't recommend",
];

/**
 * Intensifiers that amplify sentiment
 */
const POSITIVE_INTENSIFIERS = [
  'very', 'really', 'extremely', 'incredibly', 'absolutely', 'completely', 'totally',
  'highly', 'super', 'ultra', 'extra', 'especially', 'particularly',
];

const NEGATIVE_INTENSIFIERS = [
  'very', 'really', 'extremely', 'incredibly', 'absolutely', 'completely', 'totally',
  'highly', 'super', 'ultra', 'extra', 'especially', 'particularly',
];

/**
 * Negation words that flip sentiment
 */
const NEGATION_WORDS = [
  'not', "n't", "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't",
  "shouldn't", "mustn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't",
  "hadn't", "no", "never", "none", "nothing", "nobody", "nowhere", "neither", "nor",
];

/**
 * Sentiment Analysis Result
 */
export interface SentimentAnalysisResult {
  transcript: {
    sentiment: Sentiment;
    score: number;
    positiveCount: number;
    negativeCount: number;
    wordCount: number;
  };
  caption: {
    sentiment: Sentiment;
    score: number;
    positiveCount: number;
    negativeCount: number;
    wordCount: number;
  };
  combined: {
    sentiment: Sentiment;
    score: number;
    positiveCount: number;
    negativeCount: number;
    wordCount: number;
    confidence: number;
  };
  processingTimeMs: number;
}

/**
 * Detect sentiment from text using rule-based analysis
 */
export function detectSentiment(text: string): {
  sentiment: Sentiment;
  score: number;
  positiveCount: number;
  negativeCount: number;
  wordCount: number;
} {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      sentiment: 'neutral',
      score: 0,
      positiveCount: 0,
      negativeCount: 0,
      wordCount: 0,
    };
  }

  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  const wordCount = words.length;

  let score = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  // Check for positive phrases first (multi-word expressions)
  const positivePhrases = [
    'no makeup', 'no-makeup', 'makeup-free', 'makeup free', 'no makeup needed',
    'best hack', 'game changer', 'game-changer', 'life saver', 'life-saver',
    'must have', 'must-have', 'right away', 'straight away', 'fast acting', 'fast-acting',
    'good value', 'value for money', 'worth it', 'worth the', 'good for',
  ];
  
  positivePhrases.forEach((phrase) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      const count = matches.length;
      positiveCount += count * 1.5; // Phrases are more significant
      score += count * 1.5;
    }
  });

  // Check for positive words
  POSITIVE_WORDS.forEach((word) => {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      const count = matches.length;
      positiveCount += count;
      score += count;
    }
  });

  // Check for negative words
  NEGATIVE_WORDS.forEach((word) => {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      const count = matches.length;
      negativeCount += count;
      score -= count;
    }
  });

  // Handle negations (e.g., "not good", "not bad")
  const negationRegex = new RegExp(
    `\\b(${NEGATION_WORDS.join('|').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+\\w+`,
    'gi'
  );
  const negationMatches = normalizedText.match(negationRegex);
  if (negationMatches) {
    negationMatches.forEach((match) => {
      // Check if negation is followed by positive word (makes it negative)
      POSITIVE_WORDS.forEach((posWord) => {
        if (match.toLowerCase().includes(posWord)) {
          score -= 1;
          positiveCount = Math.max(0, positiveCount - 1);
          negativeCount += 1;
        }
      });
      // Check if negation is followed by negative word (makes it positive)
      NEGATIVE_WORDS.forEach((negWord) => {
        if (match.toLowerCase().includes(negWord)) {
          score += 1;
          negativeCount = Math.max(0, negativeCount - 1);
          positiveCount += 1;
        }
      });
    });
  }

  // Handle intensifiers that amplify sentiment
  // Check for intensifiers near positive/negative words
  const intensifierRegex = new RegExp(
    `\\b(${POSITIVE_INTENSIFIERS.join('|').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+\\w+`,
    'gi'
  );
  const intensifierMatches = normalizedText.match(intensifierRegex);
  if (intensifierMatches) {
    intensifierMatches.forEach((match) => {
      // Check if intensifier is followed by positive word (amplifies positive)
      POSITIVE_WORDS.forEach((posWord) => {
        if (match.toLowerCase().includes(posWord)) {
          score += 0.5; // Boost for intensifiers
          positiveCount += 0.5;
        }
      });
      // Check if intensifier is followed by negative word (amplifies negative)
      NEGATIVE_WORDS.forEach((negWord) => {
        if (match.toLowerCase().includes(negWord)) {
          score -= 0.5; // Boost for intensifiers
          negativeCount += 0.5;
        }
      });
    });
  }

  // Normalize score by word count (to avoid bias towards longer texts)
  // Use a less aggressive normalization for shorter texts
  const normalizedScore = wordCount > 0 
    ? (wordCount < 50 ? score / Math.sqrt(wordCount * 0.8) : score / Math.sqrt(wordCount))
    : score;

  // Determine sentiment with adjusted thresholds
  // Lower threshold to catch more positive reviews
  let sentiment: Sentiment;
  if (normalizedScore > 0.08) { // Lowered from 0.1
    sentiment = 'positive';
  } else if (normalizedScore < -0.08) { // Lowered from -0.1
    sentiment = 'negative';
  } else {
    // If score is close to neutral but has positive words, lean positive
    if (positiveCount > negativeCount && positiveCount >= 2) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount && negativeCount >= 2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }
  }

  return {
    sentiment,
    score: normalizedScore,
    positiveCount,
    negativeCount,
    wordCount,
  };
}

/**
 * Calculate confidence based on score magnitude and word counts
 */
function calculateConfidence(
  score: number,
  positiveCount: number,
  negativeCount: number,
  wordCount: number
): number {
  const totalSentimentWords = positiveCount + negativeCount;
  
  if (totalSentimentWords === 0) {
    return 0.3; // Low confidence if no sentiment words found
  }

  // Higher confidence if more sentiment words relative to total words
  const sentimentRatio = totalSentimentWords / Math.max(wordCount, 1);
  
  // Higher confidence if score is more extreme
  const scoreMagnitude = Math.abs(score);
  
  // Combine factors
  const confidence = Math.min(1, Math.max(0.3, 
    (sentimentRatio * 0.4) + (scoreMagnitude * 0.6)
  ));

  return Number(confidence.toFixed(3));
}

/**
 * Analyze sentiment for transcript, caption, and combined
 */
export function analyzeSentiment(
  transcript: string | null | undefined,
  caption: string | null | undefined
): SentimentAnalysisResult {
  const startTime = Date.now();

  // Analyze transcript
  const transcriptAnalysis = detectSentiment(transcript || '');

  // Analyze caption
  const captionAnalysis = detectSentiment(caption || '');

  // Analyze combined
  const combinedText = [transcript, caption].filter(Boolean).join(' ');
  const combinedAnalysis = detectSentiment(combinedText);
  const combinedConfidence = calculateConfidence(
    combinedAnalysis.score,
    combinedAnalysis.positiveCount,
    combinedAnalysis.negativeCount,
    combinedAnalysis.wordCount
  );

  const processingTime = Date.now() - startTime;

  logger.debug({
    transcript: {
      sentiment: transcriptAnalysis.sentiment,
      score: transcriptAnalysis.score,
      wordCount: transcriptAnalysis.wordCount,
    },
    caption: {
      sentiment: captionAnalysis.sentiment,
      score: captionAnalysis.score,
      wordCount: captionAnalysis.wordCount,
    },
    combined: {
      sentiment: combinedAnalysis.sentiment,
      score: combinedAnalysis.score,
      confidence: combinedConfidence,
    },
  }, 'Sentiment analysis completed');

  return {
    transcript: transcriptAnalysis,
    caption: captionAnalysis,
    combined: {
      ...combinedAnalysis,
      confidence: combinedConfidence,
    },
    processingTimeMs: processingTime,
  };
}
