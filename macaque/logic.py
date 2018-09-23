import random
import numpy as np

from PIL import Image, ImageFilter
from neuralmonkey.readers.image_reader import single_image_for_imagenet
from neuralmonkey.experiment import Experiment
from neuralmonkey.dataset import Dataset

import pdb
import json
from neuralmonkey.beamsearch_output_graph import BeamSearchOutputGraphEncoder

class Model():
    """This class serves as an interface to the Neural Monkey experiment"""

    def __init__(self):
        # initialize Resnet encoder
        self._encoder = Experiment(config_path='../models/resnet/experiment.ini')
        self._encoder.build_model()
        self._encoder.load_variables(['../models/resnet/variables.data'])

        # initialize decoder
        self._exp = Experiment(config_path='../models/captioning_en_multiref_bigger/experiment.ini')
        self._exp.build_model()
        self._exp.load_variables(['../models/captioning_en_multiref_bigger/variables.data.avg-0'])

        self._input_image_path = ""
        self._caption = []
        self._alphas = []
        self._beam_search_graph = None

    @property
    def alphas(self):
        return self._alphas

    @property
    def caption(self):
        return self._caption

    @property
    def beam_search_graph(self):
        return self._beam_search_graph

    def generate(self, rel_path):
        """Computes the caption and the alphas, running the user's
        image trough the model and returns them in a tuple
        (caption, alphas)
        """

        self._input_image_path = rel_path

        img = single_image_for_imagenet(path=rel_path,
                                        target_width=229,
                                        target_height=229,
                                        vgg_normalization=False,
                                        zero_one_normalization=True)
        data = { "images" : [img] }
        dataset = Dataset("test", data, {})

        try:
            # extract the feature representation of the image
            enc_out = self._encoder.run_model(dataset, write_out=False)
            features = enc_out[1]["resnet_features"]

            # generate the caption and extract the alpha values
            data = { "images": features }
            dataset = Dataset("test", data, {})
            _, output = self._exp.run_model(dataset, write_out=False)

            bs_graph = output["bswa_target"][0]
            hyps = bs_graph.collect_hypotheses()
            #json.dumps(bs_graph, cls=BeamSearchOutputGraphEncoder)
            self._caption = hyps["tokens"][0]

            w_count = len(hyps["alignments"][0])

            self._alphas = hyps["alignments"][0]
            self._alphas = [alph.reshape((8, 8)) for alph in self._alphas]

            self._beam_search_graph = bs_graph

            return (self._caption, self._alphas)
        except RuntimeError as rerr:
            print(rerr)
            print("Have you trained your model?")
            exit(1)

    def get_result_images(self):
        """Returns a list containing PIL images
        each visualizing the attention for a given
        word in the caption.
        """

        res = []
        ori = Image.open(self._input_image_path)

        for alp in self._alphas:
            alp = alp * 10000#00
            img = Image.fromarray(alp)
            img = img.convert("L")
            img = rescale_and_smooth(img)
            new = apply_attention_mask(ori, img)
            res.append(new)

        return res

def get_dummy_alphas(height=14, width=14, size=1):
    res = np.zeros((size, height, width), dtype=np.uint8)

    for k in range(size):
        arr = np.zeros((height, width))
        u = random.randint(0, height - 1)
        v = random.randint(0, width - 1)

        for i in range(height):
            for j in range(width):
                arr[i, j] = height**2 + width**2 - (i - u)**2 - (j - v)**2

        max = np.amax(arr)
        arr = arr / max
        res[k] = np.uint8(225 * arr)

    return res

def rescale_and_smooth(pil_image, scale=29, smooth=True):
    """Returns the original image rescaled
    and smoothened by a Gaussian filter
    """

    w = pil_image.width
    h = pil_image.height
    n_img = pil_image.resize((scale * w, scale * h))
    n_img = n_img.filter(ImageFilter.GaussianBlur(10))
    return n_img

def apply_attention_mask(orig_pil_img, mask_pil_img, alpha_channel=0.8):
    """Applies the attention mask to the original image by pasting it
    on top with a selected alpha channel, thus visualizing the workings
    of the model's attention component on the image.
    """

    assert (orig_pil_img.height == mask_pil_img.height) and \
        (orig_pil_img.width == mask_pil_img.width)
    assert alpha_channel <= 1.

    mask = mask_pil_img.convert('RGBA')
    alpha = int(255 * alpha_channel)
    mask.putalpha(alpha)

    cp = orig_pil_img.copy()
    cp.paste(mask, (0,0), mask)
    return cp
