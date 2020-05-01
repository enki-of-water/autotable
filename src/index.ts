import 'normalize.css';
import { World } from './world';
import { View } from './view';

const main = document.getElementById('main');

const world = new World();
const view = new View(main, world);

// Debugging
window['world'] = world;
window['view'] = view;

const perspectiveCheckbox = document.getElementById('perspective') as HTMLInputElement;
perspectiveCheckbox.addEventListener('change', updateSettings);
updateSettings();

function updateSettings(): void {
  const perspective = perspectiveCheckbox.checked;
  view.setPerspective(perspective);
}

view.draw();