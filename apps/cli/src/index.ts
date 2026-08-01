import { Command } from 'commander';

const program = new Command();

program
  .name('openstarter')
  .description('Command-line interface for openstarter')
  .version('0.1.0');

program.parse();
