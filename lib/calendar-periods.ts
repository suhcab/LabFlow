type Period = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
};
export function hasPeriod(
  project: Period,
): project is Period & { start_date: string; due_date: string } {
  return Boolean(
    project.start_date &&
    project.due_date &&
    project.start_date <= project.due_date,
  );
}
export function periodsOnDate<T extends Period>(
  projects: T[],
  date: string,
): T[] {
  return projects.filter(
    (project) =>
      hasPeriod(project) &&
      project.start_date <= date &&
      date <= project.due_date,
  );
}
// Inclusive dates, clipped to the visible days in this calendar week.
export function weekPeriods<T extends Period>(
  projects: T[],
  dates: (string | null)[],
) {
  return projects.flatMap((project) => {
    if (!hasPeriod(project)) return [];
    const columns = dates.flatMap((date, index) =>
      date && project.start_date <= date && date <= project.due_date
        ? [index + 1]
        : [],
    );
    if (!columns.length) return [];
    return [
      {
        project,
        first: columns[0],
        last: columns[columns.length - 1],
        continuesBefore: project.start_date < dates[columns[0] - 1]!,
        continuesAfter:
          project.due_date > dates[columns[columns.length - 1] - 1]!,
      },
    ];
  });
}
