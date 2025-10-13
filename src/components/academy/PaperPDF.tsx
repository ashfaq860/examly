
'use client';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { PaperQuestion } from '@/types/types';

// Register fonts
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

interface PaperPDFProps {
  paper: any;
  paperQuestions: any[];
  language: 'english' | 'urdu' | 'bilingual';
  translateToUrdu: (text: string) => string;
}

export function PaperPDF({ paper, paperQuestions, language, translateToUrdu }: PaperPDFProps) {
  const isUrdu = language === 'urdu';
  const isBilingual = language === 'bilingual';

  const titleText = `Paper Title: ${paper.title}`;
  const urduTitle = `پرچے کا عنوان: ${translateToUrdu(paper.title)}`;

  return (
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

          {paperQuestions.map((pq: any) => {
            const q = pq.questions;
            const questionText = q?.question_text || 'Question text not available';
            const urduQuestion = translateToUrdu(questionText);
            const questionPrefix = `${pq.order_number}. [${pq.question_type.toUpperCase()}] `;

            return (
              <View key={pq.id} style={{ marginBottom: 20 }}>
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

          {(!paperQuestions || paperQuestions.length === 0) && (
            <Text style={styles.question}>No questions available for this paper.</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}