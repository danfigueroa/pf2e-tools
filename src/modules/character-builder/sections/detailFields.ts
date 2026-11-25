import { tr } from '../../../i18n';
import type { BuildState } from '../types';

type DetailKey = keyof BuildState['details'];
export const DETAIL_FIELDS: { key: Exclude<DetailKey, 'portrait'>; label: string }[] = [
  { key: 'age', label: tr('Idade', 'Age') },
  { key: 'gender', label: tr('Gênero', 'Gender') },
  { key: 'pronouns', label: tr('Pronomes', 'Pronouns') },
  { key: 'ethnicity', label: tr('Etnia', 'Ethnicity') },
  { key: 'nationality', label: tr('Nacionalidade', 'Nationality') },
];
