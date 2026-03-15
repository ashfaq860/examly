// src/lib/generatePDF.ts
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { renderToStream } from '@react-pdf/renderer';

// Urdu translation mapping (same as before)
const urduTranslations: Record<string, string> = {
  // ... (keep your existing translations)
};

function translateToUrdu(text: string): string {
  return urduTranslations[text.toLowerCase()] || text;
}

// Register fonts (this will work on server side)
try {
  Font.register({
    family: 'Roboto',
    src: '/fonts/Roboto-Regular.ttf',
  });

  Font.register({
    family: 'Jameel',
    src: '/fonts/Jameel Noori Nastaleeq Kasheeda.ttf',
  });

  Font.register({
    family: 'NotoUrdu',
    src: '/fonts/NotoNastaliqUrdu-Regular.ttf',
  });
} catch (error) {
  console.warn('Font registration failed, using fallback fonts:', error);
}

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Roboto',
  },
  title: {
    fontSize: 16,
    marginBottom: 10,
  },
  urduTitle: {
    fontSize: 14,
    marginBottom: 20,
    fontFamily: 'Jameel',
  },
  question: {
    fontSize: 12,
    marginBottom: 10,
  },
  urduQuestion: {
    fontSize: 12,
    marginBottom: 15,
    fontFamily: 'Jameel',
  },
  option: {
    fontSize: 11,
    marginLeft: 20,
    marginBottom: 5,
  },
  urduOption: {
    fontSize: 11,
    marginLeft: 20,
    marginBottom: 8,
    fontFamily: 'Jameel',
  },
});

interface PaperData {
  title: string;
  questions: Array<{
    order_number: number;
    question_type: string;
    questions: {
      question_text?: string;
      option_a?: string;
      option_b?: string;
      option_c?: string;
      option_d?: string;
    };
  }>;
}

export async function generatePaperPDF(paper: PaperData, language: 'english' | 'urdu' | 'bilingual') {
  const isUrdu = language === 'urdu';
  const isBilingual = language === 'bilingual';

  const titleText = `Paper Title: ${paper.title}`;
  const urduTitle = `پرچے کا عنوان: ${translateToUrdu(paper.title)}`;

  // Create PDF document using react-pdf's API
  const MyDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          {!isUrdu && (
            <Text style={styles.title}>{titleText}</Text>
          )}
          {(isUrdu || isBilingual) && (
            <Text style={styles.urduTitle}>{urduTitle}</Text>
          )}
          {isBilingual && !isUrdu && (
            <Text style={styles.title}>{titleText}</Text>
          )}

          {paper.questions.map((pq, index) => {
            const q = pq.questions;
            const questionText = q?.question_text || 'Question text not available';
            const urduQuestion = translateToUrdu(questionText);
            const questionPrefix = `${pq.order_number}. [${pq.question_type.toUpperCase()}] `;

            return (
              <View key={index} style={{ marginBottom: 20 }}>
                {/* English question */}
                {!isUrdu && (
                  <Text style={styles.question}>
                    {questionPrefix + questionText}
                  </Text>
                )}
                
                {/* Urdu question or bilingual */}
                {(isUrdu || isBilingual) && (
                  <Text style={styles.urduQuestion}>
                    {questionPrefix + urduQuestion}
                  </Text>
                )}

                {/* MCQ options */}
                {pq.question_type === 'mcq' && (
                  <View>
                    {[
                      { letter: 'A', text: q?.option_a },
                      { letter: 'B', text: q?.option_b },
                      { letter: 'C', text: q?.option_c },
                      { letter: 'D', text: q?.option_d }
                    ].map((option) => {
                      if (!option.text) return null;
                      const urduOption = translateToUrdu(option.text);
                      
                      return (
                        <View key={option.letter}>
                          {isUrdu ? (
                            <Text style={styles.urduOption}>
                              {option.letter}) {urduOption}
                            </Text>
                          ) : isBilingual ? (
                            <>
                              <Text style={styles.option}>
                                {option.letter}) {option.text}
                              </Text>
                              <Text style={styles.urduOption}>
                                {urduOption}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.option}>
                              {option.letter}) {option.text}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {(!paper.questions || paper.questions.length === 0) && (
            <Text style={styles.question}>No questions available for this paper.</Text>
          )}
        </View>
      </Page>
    </Document>
  );

  // Render to stream
  const stream = await renderToStream(<MyDocument />);
  
  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}