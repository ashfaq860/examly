import React from 'react';

interface DoughnutChartProps {
  data: {
    subject: string;
    count: number;
    color: string;
  }[];
}

const DoughnutChart: React.FC<DoughnutChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let cumulativePercent = 0;
  
  return (
    <svg viewBox="0 0 100 100" className="w-100 h-100">
      {data.map((item, index) => {
        const percent = (item.count / total) * 100;
        const startPercent = cumulativePercent;
        cumulativePercent += percent;
        
        return (
          <circle
            key={item.subject}
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            stroke={item.color}
            strokeWidth="10"
            strokeDasharray={`${percent} ${100 - percent}`}
            strokeDashoffset={-startPercent + 25}
            transform="rotate(-90) translate(-100)"
          />
        );
      })}
    </svg>
  );
};

export default DoughnutChart;