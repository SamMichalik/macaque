from neuralmonkey.readers.image_reader import single_image_for_imagenet
from neuralmonkey.experiment import Experiment
from neuralmonkey.dataset.dataset import Dataset

class Model():

    def __init__(self):
        self.exp = Experiment(config_path='../models/captioning_1.ini')
        self.exp.build_model()

    def generate_caption(self, rel_path):
        img = single_image_for_imagenet(path=rel_path,
                                        target_width=224,
                                        target_height=224,
                                        vgg_normalization=True,
                                        zero_one_normalization=False)
        data = { "images" : [img] }
        dataset = Dataset("test", data, {})
        try:
            _, output = self.exp.run_model(dataset, write_out=False)
            return output["target"][0]
        except RuntimeError as rerr:
            print(rerr)
            print("Have you trained your model?")
            exit(1)
