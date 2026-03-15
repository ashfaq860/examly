import { Class, Subject, ClassSubject } from '@/types/types';

interface ClassListProps {
  classes: Class[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  role: string;
}

export default function ClassList({ classes, subjects, classSubjects, role }: ClassListProps) {
  // Create a map of class to subjects
  const classSubjectMap = new Map<string, Subject[]>();
  
  classes.forEach(cls => {
    const subjectIds = classSubjects
      .filter(cs => cs.class_id === cls.id)
      .map(cs => cs.subject_id);
    
    const classSubjectsList = subjects.filter(subject => 
      subjectIds.includes(subject.id)
    );
    
    classSubjectMap.set(cls.id, classSubjectsList);
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Classes</h2>
        {role === 'academy' && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition">
            Add New Class
          </button>
        )}
      </div>

      <div className="space-y-4">
        {classes.length === 0 ? (
          <p className="text-gray-500">No classes found</p>
        ) : (
          classes.map(cls => (
            <div key={cls.id} className="border rounded-lg p-4">
              <h3 className="font-medium text-lg">Class {cls.name}</h3>
              {cls.description && (
                <p className="text-gray-600 text-sm mb-2">{cls.description}</p>
              )}
              
              <div className="mt-2">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Subjects:</h4>
                {classSubjectMap.get(cls.id)?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {classSubjectMap.get(cls.id)?.map(subject => (
                      <span 
                        key={subject.id} 
                        className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-800"
                      >
                        {subject.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No subjects assigned</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}