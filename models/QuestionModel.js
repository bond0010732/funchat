const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    level: {
        type: String,
        required: true,
        enum: ['Level1','Level2','Level3','Level4','Level5','Level6','Level7','Level8','Level9','Level10'], // Limit levels to predefined options
      },
      question: {
        type: String,
        required: true,
      },
      options: {
        type: [String], // Array of strings
        required: true,
      },
      correctAnswer: {
        type: String,
        required: true,
      },
      createdAt: { type: Date, default: Date.now },
});

// module.exports = mongoose.model('Batch', BatchSchema);

const QuestionModel = mongoose.model('Questiondb', QuestionSchema);

module.exports = QuestionModel;