import { ChevronDown, Copy, CopyCheck, FileDown } from 'lucide-react';
import { RefObject, useState } from 'react';
import * as XLSX from 'xlsx';

import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

interface Props {
  tableRef: RefObject<HTMLTableElement>;
}

const CustomTableActionBar = ({ tableRef }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleExport = (to: 'xlsx' | 'csv' = 'xlsx') => {
    if (!tableRef.current) {
      return;
    }

    const wb = XLSX.utils.table_to_book(tableRef.current, {
      sheet: 'Sheet 1'
    });

    XLSX.writeFile(wb, `table-data.${to}`);
  };

  const handleCopy = () => {
    if (!tableRef.current) return;

    const ws = XLSX.utils.table_to_sheet(tableRef.current);
    const output = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="p-4 border-t flex justify-end items-center gap-2">
      <div className="inline-flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => handleExport('xlsx')}
              className="cursor-pointer"
            >
              Export to Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExport('csv')}
              className="cursor-pointer"
            >
              Export as CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="inline-flex items-center">
        <Button onClick={() => handleCopy()} variant="outline" size="sm">
          {copied ? (
            <CopyCheck className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
};

export { CustomTableActionBar };
