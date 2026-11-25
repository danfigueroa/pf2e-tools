import { Box, ButtonBase, Typography } from '@mui/material';
import { ChevronRight as OpenIcon } from '@mui/icons-material';
import { tr } from '../../../i18n';

/** Um campo de escolha do catálogo: mostra o escolhido (ou "Escolher…") e abre o seletor. */
export function PickerField({ label, value, hint, onOpen, disabled }: {
  label: string;
  value?: string;
  hint?: string;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <ButtonBase onClick={onOpen} disabled={disabled} data-view=""
      sx={{ display: 'flex', width: 1, textAlign: 'left', alignItems: 'center', gap: 1, p: 1.5, minHeight: 56,
        border: 1, borderColor: value ? 'divider' : 'warning.main', borderRadius: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" component="p">{label}</Typography>
        <Typography sx={{ fontWeight: value ? 600 : 400, overflowWrap: 'anywhere' }} color={value ? 'text.primary' : 'text.secondary'}>
          {value ?? tr('Escolher…', 'Choose…')}
        </Typography>
        {hint && <Typography variant="caption" color="text.secondary" component="p">{hint}</Typography>}
      </Box>
      <OpenIcon color="action" />
    </ButtonBase>
  );
}
