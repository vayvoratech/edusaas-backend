const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Assessment Database Seeding ---');

  // 1. Seed Difficulty Levels
  const difficultyData = [
    { difficulty_id: 1, difficulty_name: 'Easy', difficulty_order: 1 },
    { difficulty_id: 2, difficulty_name: 'Medium', difficulty_order: 2 },
    { difficulty_id: 3, difficulty_name: 'Hard', difficulty_order: 3 },
    { difficulty_id: 4, difficulty_name: 'Very Hard', difficulty_order: 4 },
  ];

  for (const diff of difficultyData) {
    await prisma.difficultyLevel.upsert({
      where: { difficulty_id: diff.difficulty_id },
      update: { difficulty_name: diff.difficulty_name, difficulty_order: diff.difficulty_order },
      create: diff,
    });
  }
  console.log('Difficulty levels seeded.');

  // 2. Seed Skills
  const skillsData = [
    { skill_name: 'Python', category: 'Programming', description: 'Core Python syntax, data structures, and libraries' },
    { skill_name: 'Machine Learning', category: 'AI & ML', description: 'Supervised, unsupervised algorithms and evaluation' },
    { skill_name: 'Deep Learning', category: 'AI & ML', description: 'Neural networks, CNNs, transformers, and backprop' },
    { skill_name: 'Statistics', category: 'Mathematics', description: 'Probability, hypothesis testing, distributions, variance' },
    { skill_name: 'Data Preprocessing', category: 'Data Engineering', description: 'Feature scaling, missing values, encoding' },
    { skill_name: 'SQL', category: 'Database', description: 'Queries, joins, grouping, indexing' },
    { skill_name: 'JavaScript', category: 'Frontend', description: 'ES6, async/await, DOM, closures' },
    { skill_name: 'React', category: 'Frontend', description: 'Hooks, state, components, virtual DOM' },
    { skill_name: 'Node.js', category: 'Backend', description: 'Express, async event loop, APIs' },
    { skill_name: 'Docker', category: 'DevOps', description: 'Containers, Dockerfiles, images, compose' },
  ];

  const skillMap = {};
  for (const s of skillsData) {
    const record = await prisma.skill.upsert({
      where: { skill_name: s.skill_name },
      update: { category: s.category, description: s.description },
      create: s,
    });
    skillMap[s.skill_name] = record.skill_id;
  }
  console.log('Skills seeded:', Object.keys(skillMap));

  // 3. Link Domain Roles to Required Skills
  const aiRole = await prisma.domainRole.findFirst({
    where: { domain_name: 'AI Engineer' },
  });

  if (aiRole) {
    const aiSkills = ['Python', 'Machine Learning', 'Deep Learning', 'Statistics', 'Data Preprocessing'];
    for (const skillName of aiSkills) {
      const skillId = skillMap[skillName];
      if (skillId) {
        await prisma.domainRequiredSkill.upsert({
          where: {
            domain_role_id_skill_id: {
              domain_role_id: aiRole.domain_role_id,
              skill_id: skillId,
            },
          },
          update: { required_level: 4 },
          create: {
            domain_role_id: aiRole.domain_role_id,
            skill_id: skillId,
            required_level: 4,
          },
        });
      }
    }
    console.log('AI Engineer domain skills linked successfully.');
  }

  // Also link for Machine Learning Engineer
  const mlRole = await prisma.domainRole.findFirst({
    where: { domain_name: 'Machine Learning Engineer' },
  });
  if (mlRole) {
    const mlSkills = ['Python', 'Machine Learning', 'Statistics', 'Data Preprocessing'];
    for (const skillName of mlSkills) {
      const skillId = skillMap[skillName];
      if (skillId) {
        await prisma.domainRequiredSkill.upsert({
          where: {
            domain_role_id_skill_id: {
              domain_role_id: mlRole.domain_role_id,
              skill_id: skillId,
            },
          },
          update: { required_level: 4 },
          create: {
            domain_role_id: mlRole.domain_role_id,
            skill_id: skillId,
            required_level: 4,
          },
        });
      }
    }
  }

  // 4. Seed Questions (Easy = 1, Medium = 2, Hard = 3, Very Hard = 4)
  const questions = [
    // --- PYTHON ---
    {
      skill: 'Python',
      diff: 1,
      text: 'Which keyword is used to define a function in Python?',
      a: 'function', b: 'def', c: 'func', d: 'define',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 1,
      text: 'What is the output of print(type([])) in Python?',
      a: "<class 'list'>", b: "<class 'array'>", c: "<class 'tuple'>", d: "<class 'dict'>",
      correct: 'A',
    },
    {
      skill: 'Python',
      diff: 1,
      text: 'Which Python library is primary for numerical array computing?',
      a: 'React', b: 'NumPy', c: 'Express', d: 'Django',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 2,
      text: 'What is a list comprehension in Python?',
      a: 'A way to sort dictionaries', b: 'A concise syntax to generate lists from iterables', c: 'A compiler optimization', d: 'A type of lambda expression',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 2,
      text: 'What does the self parameter represent in a Python class method?',
      a: 'The parent superclass', b: 'A reference to the current instance of the class', c: 'A global module variable', d: 'A static class variable',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 2,
      text: 'Which data structure in Python is immutable?',
      a: 'List', b: 'Tuple', c: 'Dictionary', d: 'Set',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 3,
      text: 'What does the *args parameter allow in a Python function definition?',
      a: 'Passing keyword arguments as a dictionary', b: 'Passing a variable number of positional arguments as a tuple', c: 'Pointers to memory', d: 'Enforcing type constraints',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 3,
      text: 'What is a Python decorator?',
      a: 'A CSS class in web framework', b: 'A function that takes another function and extends its behavior without modifying it', c: 'A GUI widget', d: 'A garbage collector directive',
      correct: 'B',
    },
    {
      skill: 'Python',
      diff: 4,
      text: 'What is the Global Interpreter Lock (GIL) in CPython?',
      a: 'A mutex that prevents multiple native threads from executing Python bytecode simultaneously', b: 'A security sandbox for untrusted scripts', c: 'A filesystem lock', d: 'A JIT compilation flag',
      correct: 'A',
    },
    {
      skill: 'Python',
      diff: 4,
      text: 'How does the __slots__ declaration optimize memory in Python classes?',
      a: 'By preventing the creation of an internal __dict__ per instance', b: 'By running on GPU', c: 'By caching method bytecode', d: 'By converting fields to C structs automatically',
      correct: 'A',
    },

    // --- MACHINE LEARNING ---
    {
      skill: 'Machine Learning',
      diff: 1,
      text: 'What is supervised learning?',
      a: 'Training on unlabeled clusters', b: 'Training an algorithm on labeled input-output pairs', c: 'Reinforcement through game scores', d: 'Unsupervised dimensionality reduction',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 1,
      text: 'Which metric measures the fraction of correct predictions out of all predictions?',
      a: 'Loss', b: 'Accuracy', c: 'Recall', d: 'Variance',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 1,
      text: 'Which of the following is a classification algorithm?',
      a: 'K-Means', b: 'Logistic Regression', c: 'PCA', d: 'Linear Regression for continuous targets',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 2,
      text: 'What is overfitting in machine learning?',
      a: 'Model underperforms on training data', b: 'Model learns noise in training data and performs poorly on unseen test data', c: 'Model trains too fast', d: 'Model has too few parameters',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 2,
      text: 'Why do we split data into training and test sets?',
      a: 'To make computation faster', b: 'To evaluate how well the model generalizes to new, unseen data', c: 'To delete outliers', d: 'To normalize features',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 2,
      text: 'Which algorithm is widely used for unsupervised clustering?',
      a: 'Decision Tree', b: 'K-Means', c: 'Naive Bayes', d: 'Linear SVM',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 3,
      text: 'What does the ROC-AUC curve evaluate?',
      a: 'Clustering inertia', b: 'The trade-off between True Positive Rate and False Positive Rate across thresholds', c: 'Training execution time', d: 'Regression mean squared error',
      correct: 'B',
    },
    {
      skill: 'Machine Learning',
      diff: 3,
      text: 'What is the primary difference between L1 (Lasso) and L2 (Ridge) regularization?',
      a: 'L1 can shrink coefficients exactly to zero, producing sparse models; L2 shrinks them toward zero', b: 'L1 is for classification, L2 for regression', c: 'L2 removes all features', d: 'L1 is unsupervised',
      correct: 'A',
    },
    {
      skill: 'Machine Learning',
      diff: 4,
      text: 'What is the bias-variance tradeoff?',
      a: 'The conflict between underfitting due to erroneous assumptions vs. overfitting due to sensitivity to training noise', b: 'The CPU vs GPU memory tradeoff', c: 'Precision vs recall inversion', d: 'Gradient clipping threshold',
      correct: 'A',
    },
    {
      skill: 'Machine Learning',
      diff: 4,
      text: 'How does AdaBoost handle misclassified samples from previous weak learners?',
      a: 'It drops them from the training set', b: 'It increases their weights so subsequent learners focus more on difficult cases', c: 'It inverts their labels', d: 'It clips their gradients to zero',
      correct: 'B',
    },

    // --- DEEP LEARNING ---
    {
      skill: 'Deep Learning',
      diff: 1,
      text: 'What is the primary inspiration behind artificial neural networks?',
      a: 'Relational database schema', b: 'Biological neural networks in the human brain', c: 'Operating system scheduling', d: 'Compiler abstract syntax trees',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 1,
      text: 'What is an epoch in deep learning?',
      a: 'A single weight update', b: 'One complete pass through the entire training dataset', c: 'A batch of 32 images', d: 'A hidden layer activation',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 1,
      text: 'Which architecture is primarily designed for image processing tasks?',
      a: 'Recurrent Neural Network (RNN)', b: 'Convolutional Neural Network (CNN)', c: 'Word2Vec', d: 'Autoencoder only',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 2,
      text: 'What is the purpose of an activation function like ReLU?',
      a: 'To initialize model weights', b: 'To introduce non-linearity, allowing the network to learn complex relationships', c: 'To normalize image file sizes', d: 'To calculate accuracy',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 2,
      text: 'What does backpropagation compute during neural network training?',
      a: 'The forward pass predictions', b: 'Gradients of the loss function with respect to weights using the chain rule', c: 'Learning rate decay schedules', d: 'Batch normalization statistics',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 2,
      text: 'What is the main advantage of Dropout during training?',
      a: 'It reduces training speed', b: 'It prevents co-adaptation of neurons and reduces overfitting', c: 'It doubles the learning rate', d: 'It converts floats to integers',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 3,
      text: 'What is the vanishing gradient problem commonly observed in deep RNNs or sigmoid networks?',
      a: 'Gradients become exponentially small as they backpropagate, preventing early layers from updating', b: 'Weights explode to infinity', c: 'Weights drop to negative values', d: 'Memory leaks in CUDA',
      correct: 'A',
    },
    {
      skill: 'Deep Learning',
      diff: 3,
      text: 'What is the key mechanism introduced by the Transformer architecture (Vaswani et al.)?',
      a: 'Convolutional filters', b: 'Self-attention mechanism allowing parallel processing of token relationships', c: 'Recurrent hidden states', d: 'Markov chains',
      correct: 'B',
    },
    {
      skill: 'Deep Learning',
      diff: 4,
      text: 'Why does Layer Normalization perform better than Batch Normalization in Transformer models for NLP?',
      a: 'Because it computes statistics across feature dimensions for each individual sequence, handling variable sequence lengths independent of batch size', b: 'Because it disables GPU memory caching', c: 'Because it uses L1 loss', d: 'Because it only runs during inference',
      correct: 'A',
    },
    {
      skill: 'Deep Learning',
      diff: 4,
      text: 'What is the role of the temperature parameter in Softmax during text generation?',
      a: 'Controls GPU temperature', b: 'Scales logits before Softmax; higher temperature increases randomness/diversity, while lower temperature makes predictions more deterministic', c: 'Controls weight decay', d: 'Sets the learning rate',
      correct: 'B',
    },

    // --- STATISTICS ---
    {
      skill: 'Statistics',
      diff: 1,
      text: 'What is the median of a dataset?',
      a: 'The sum of all values divided by count', b: 'The middle value when the data is ordered', c: 'The most frequently occurring value', d: 'The difference between max and min',
      correct: 'B',
    },
    {
      skill: 'Statistics',
      diff: 1,
      text: 'What is probability constrained to lie between?',
      a: '-1 and 1', b: '0 and 1', c: '0 and 100 always', d: '-infinity and +infinity',
      correct: 'B',
    },
    {
      skill: 'Statistics',
      diff: 2,
      text: 'What shape does a standard normal distribution have?',
      a: 'Uniform rectangle', b: 'Symmetric bell curve', c: 'Exponential decay curve', d: 'Bimodal U-shape',
      correct: 'B',
    },
    {
      skill: 'Statistics',
      diff: 2,
      text: 'What does a p-value less than 0.05 typically suggest in hypothesis testing?',
      a: 'The null hypothesis cannot be rejected', b: 'Statistically significant evidence to reject the null hypothesis', c: 'The sample size was too small', d: 'The data is normally distributed',
      correct: 'B',
    },
    {
      skill: 'Statistics',
      diff: 3,
      text: 'What does the Central Limit Theorem state?',
      a: 'All datasets are normally distributed', b: 'The distribution of sample means approaches a normal distribution as sample size grows, regardless of population distribution shape', c: 'Correlation implies causation', d: 'Variance equals standard deviation',
      correct: 'B',
    },
    {
      skill: 'Statistics',
      diff: 4,
      text: 'What is Bayes Theorem used for in conditional probability?',
      a: 'Updating the probability of a hypothesis as more evidence becomes available: P(A|B) = [P(B|A)*P(A)] / P(B)', b: 'Testing whether two variables have zero correlation', c: 'Finding linear regression intercept', d: 'Calculating standard error of the mean',
      correct: 'A',
    },

    // --- DATA PREPROCESSING ---
    {
      skill: 'Data Preprocessing',
      diff: 1,
      text: 'What is data preprocessing?',
      a: 'Deploying models to production', b: 'Cleaning, transforming, and preparing raw data for model training', c: 'Writing API documentation', d: 'Creating dashboard visuals only',
      correct: 'B',
    },
    {
      skill: 'Data Preprocessing',
      diff: 1,
      text: 'What is an outlier in a dataset?',
      a: 'The target prediction column', b: 'A data point that differs significantly from other observations in the dataset', c: 'A missing value', d: 'A duplicate column name',
      correct: 'B',
    },
    {
      skill: 'Data Preprocessing',
      diff: 2,
      text: 'What is One-Hot Encoding used for?',
      a: 'Compressing audio files', b: 'Converting categorical variables into binary indicator vectors for ML algorithms', c: 'Scaling continuous numbers between 0 and 1', d: 'Imputing missing values with mean',
      correct: 'B',
    },
    {
      skill: 'Data Preprocessing',
      diff: 2,
      text: 'Why is Min-Max feature scaling (normalization) applied to numerical inputs?',
      a: 'To remove duplicate rows', b: 'To rescale features into a common range [0, 1] so features with large scales do not dominate distance-based algorithms', c: 'To eliminate categorical features', d: 'To convert integers to strings',
      correct: 'B',
    },
    {
      skill: 'Data Preprocessing',
      diff: 3,
      text: 'When handling missing values in time-series data, which method is typically preferred over mean imputation?',
      a: 'Dropping all rows with nulls', b: 'Forward-fill (LOCF) or interpolation to maintain chronological continuity', c: 'Replacing with random noise', d: 'One-hot encoding the timestamps',
      correct: 'B',
    },
    {
      skill: 'Data Preprocessing',
      diff: 4,
      text: 'What is data leakage and how can it occur during preprocessing?',
      a: 'When an attacker extracts database secrets', b: 'When information from outside the training dataset (such as test set statistics during scaling or imputation) inadvertently influences model training', c: 'When a model runs out of RAM', d: 'When categorical variables have high cardinality',
      correct: 'B',
    },
  ];

  let qCount = 0;
  for (const q of questions) {
    const sId = skillMap[q.skill];
    if (!sId) continue;

    await prisma.question.create({
      data: {
        skill_id: sId,
        difficulty_id: q.diff,
        question_text: q.text,
        option_a: q.a,
        option_b: q.b,
        option_c: q.c,
        option_d: q.d,
        correct_option: q.correct,
        marks: q.diff,
        is_active: true,
        assessment_type: 'INITIAL',
      },
    });
    qCount++;
  }

  console.log(`Successfully seeded ${qCount} questions into PostgreSQL!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
